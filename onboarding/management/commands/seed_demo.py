import os
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from onboarding.models import Case, Document, Audit
from onboarding.extraction import extract
class Command(BaseCommand):
    help = 'Create an explicit local demo user and synthetic review case; idempotent.'
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Demo seeding is disabled outside APP_ENV=demo.')
        user, created = get_user_model().objects.get_or_create(username='reviewer')
        if created:
            user.set_password(os.getenv('DEMO_PASSWORD', 'local-review-only'))
            user.save()
        if not Case.objects.exists():
            case = Case.objects.create(name='Cedar Works · supplier application')
            for kind in ('registration', 'bank', 'form'):
                pages = [(settings.BASE_DIR / 'fixtures' / f'{kind}.txt').read_text()]
                fields, mode = extract(pages, mode='baseline')
                Document.objects.create(case=case, kind=kind, name=f'{kind}.txt', pages=pages, fields=fields, mode=mode)
            Audit.objects.create(case=case, actor='demo seed', action='created', details={'note': 'Synthetic documents with one intentional registration conflict.'})
        self.stdout.write('Demo ready. Username: reviewer. Password: DEMO_PASSWORD or local-review-only. Local use only.')
