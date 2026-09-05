import json
from functools import wraps
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from .models import Case, Document, Audit
from .extraction import FIELDS, KINDS, read_pages, extract, assessment

def protected(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Sign in to continue.'}, status=401)
        try:
            return view(request, *args, **kwargs)
        except Case.DoesNotExist:
            return JsonResponse({'error': 'Case not found.'}, status=404)
        except (ValueError, json.JSONDecodeError) as exc:
            return JsonResponse({'error': str(exc)}, status=400)
    return wrapped

def body(request):
    data = json.loads(request.body or '{}')
    if not isinstance(data, dict):
        raise ValueError('Expected a JSON object.')
    return data

def serialize(case):
    documents = list(case.documents.order_by('id'))
    return {'id': case.pk, 'name': case.name, 'status': case.status, 'created_at': case.created_at.isoformat(), **assessment(documents, case.corrections), 'documents': [{'id': d.pk, 'name': d.name, 'kind': d.kind, 'mode': d.mode, 'pages': d.pages} for d in documents], 'events': [{'actor': e.actor, 'action': e.action, 'details': e.details, 'at': e.created_at.isoformat()} for e in case.events.order_by('-id')]}

@ensure_csrf_cookie
@require_http_methods(['GET'])
def session(request):
    import os
    return JsonResponse({'user': request.user.username if request.user.is_authenticated else None, 'mode': os.getenv('EXTRACTION_MODE', 'baseline'), 'demo': settings.DEBUG})

@require_http_methods(['POST'])
def signin(request):
    try:
        data = body(request)
        if not all(isinstance(data.get(k), str) for k in ('username', 'password')):
            raise ValueError('Enter your username and password.')
        user = authenticate(request, username=data['username'], password=data['password'])
        if not user:
            return JsonResponse({'error': 'Invalid username or password.'}, status=401)
        login(request, user)
        return JsonResponse({'user': user.username})
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)

@require_http_methods(['POST'])
def signout(request):
    logout(request)
    return JsonResponse({'ok': True})

@require_http_methods(['GET', 'POST'])
@protected
def cases(request):
    if request.method == 'POST':
        name = body(request).get('name')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 160:
            raise ValueError('Case name must contain 1–160 characters.')
        with transaction.atomic():
            case = Case.objects.create(name=name.strip())
            Audit.objects.create(case=case, actor=request.user.username, action='created')
        return JsonResponse(serialize(case), status=201)
    return JsonResponse({'cases': [serialize(c) for c in Case.objects.order_by('-id')]})

@require_http_methods(['GET'])
@protected
def case(request, pk):
    return JsonResponse(serialize(Case.objects.get(pk=pk)))

@require_http_methods(['POST'])
@protected
def upload(request, pk):
    existing = Case.objects.get(pk=pk)
    if existing.status != 'pending':
        raise ValueError('Decided cases are read-only. Create a new case for a new review.')
    kind = request.POST.get('kind')
    file = request.FILES.get('file')
    if kind not in KINDS or not file:
        raise ValueError('Choose a document type and file.')
    pages = read_pages(file.name, file.read(5 * 1024 * 1024 + 1))
    fields, mode = extract(pages)
    with transaction.atomic():
        case = Case.objects.select_for_update().get(pk=pk)
        if case.status != 'pending':
            raise ValueError('Decided cases are read-only. Create a new case for a new review.')
        document = Document.objects.create(case=case, name=file.name[:200], kind=kind, pages=pages, fields=fields, mode=mode)
        # New evidence invalidates previous corrections so reviewers reconsider contradictions.
        case.corrections = {}
        case.save(update_fields=['corrections'])
        Audit.objects.create(case=case, actor=request.user.username, action='document uploaded', details={'document': document.name, 'mode': mode, 'previous_corrections_cleared': True})
    return JsonResponse(serialize(case), status=201)

@require_http_methods(['POST'])
@protected
def review(request, pk):
    data = body(request)
    decision = data.get('decision', 'save')
    corrections = data.get('corrections', {})
    reason = data.get('reason', '')
    if decision not in ('save', 'approved', 'rejected') or not isinstance(corrections, dict) or set(corrections) - set(FIELDS):
        raise ValueError('Invalid review.')
    if any(not isinstance(v, str) or not 1 <= len(v.strip()) <= 200 for v in corrections.values()):
        raise ValueError('Corrections must contain 1–200 characters.')
    if not isinstance(reason, str) or not 5 <= len(reason.strip()) <= 2000:
        raise ValueError('Explain the review in 5–2,000 characters.')
    with transaction.atomic():
        case = Case.objects.select_for_update().get(pk=pk)
        if case.status != 'pending':
            raise ValueError('This case has already been decided.')
        case.corrections.update({k: v.strip() for k, v in corrections.items()})
        if decision == 'approved' and not assessment(list(case.documents.all()), case.corrections)['ready']:
            raise ValueError('Resolve every field and upload all three document types before approval.')
        if decision != 'save':
            case.status = decision
        case.save()
        Audit.objects.create(case=case, actor=request.user.username, action='corrections saved' if decision == 'save' else decision, details={'reason': reason.strip(), 'corrections': corrections})
    return JsonResponse(serialize(case))
