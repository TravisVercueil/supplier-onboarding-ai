import io
import json
import os
from pathlib import Path
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, SimpleTestCase
from pypdf import PdfWriter
from .extraction import extract, read_pages, validate_evidence
from .models import Case, Audit

class ExtractionTests(SimpleTestCase):
    def test_baseline_quotes_and_page(self):
        fields, mode = extract(['Cover page', 'Supplier name: Cedar Works\nRegistration number: DEMO-001'], mode='baseline')
        self.assertEqual(fields['supplier_name'], {'value': 'Cedar Works', 'page': 2, 'quote': 'Supplier name: Cedar Works'})
        self.assertEqual(mode, 'baseline')
        self.assertNotIn('bank_account', fields)

    def test_repeated_conflicting_values_rejected(self):
        for pages in [['Supplier name: Cedar\nSupplier name: Elm'], ['Supplier name: Cedar', 'Supplier name: Elm']]:
            with self.subTest(pages=pages), self.assertRaises(ValueError):
                extract(pages, mode='baseline')

    def test_blank_field_does_not_capture_next_line(self):
        fields, _ = extract(['Supplier name: \nBank account: DEMO-005'], mode='baseline')
        self.assertNotIn('supplier_name', fields)
        self.assertEqual(fields['bank_account']['value'], 'DEMO-005')

    def test_real_text_pdf_extraction(self):
        from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
        writer = PdfWriter()
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
        content = DecodedStreamObject(); content.set_data(b'BT /F1 12 Tf 50 700 Td (Supplier name: Cedar Works) Tj ET')
        page[NameObject('/Contents')] = writer._add_object(content)
        output = io.BytesIO(); writer.write(output)
        pages = read_pages('certificate.pdf', output.getvalue())
        fields, _ = extract(pages, mode='baseline')
        self.assertEqual(fields['supplier_name']['value'], 'Cedar Works')
        self.assertEqual(fields['supplier_name']['page'], 1)

    def test_invalid_uploads(self):
        for name, data in [('file.exe', b'x'), ('file.pdf', b'not pdf'), ('file.txt', b'\xff'), ('file.txt', b''), ('file.txt', b'a' * (5 * 1024 * 1024 + 1))]:
            with self.subTest(name=name, length=len(data)), self.assertRaises(ValueError):
                read_pages(name, data)

    def test_scanned_pdf_rejected(self):
        writer = PdfWriter(); writer.add_blank_page(width=100, height=100)
        output = io.BytesIO(); writer.write(output)
        with self.assertRaises(ValueError):
            read_pages('scan.pdf', output.getvalue())

    def test_hallucinated_model_evidence_rejected(self):
        for evidence in [{'value': 'Invented', 'page': 1, 'quote': 'Supplier name: Cedar Works'}, {'value': 'Cedar', 'page': 2, 'quote': 'Supplier name: Cedar Works'}, {'value': 'Cedar', 'page': True, 'quote': 'Supplier name: Cedar Works'}]:
            with self.subTest(evidence=evidence), self.assertRaises(ValueError):
                validate_evidence({'supplier_name': evidence}, ['Supplier name: Cedar Works'])

    @patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key', 'OPENAI_MODEL': 'test-model'})
    @patch('onboarding.extraction.urlopen')
    def test_provider_adapter_with_stubbed_response(self, network):
        response = {'choices': [{'message': {'content': json.dumps({'supplier_name': {'value': 'Cedar Works', 'page': 1, 'quote': 'Supplier name: Cedar Works'}})}}]}
        network.return_value.__enter__.return_value = io.BytesIO(json.dumps(response).encode())
        fields, mode = extract(['Supplier name: Cedar Works'], mode='openai')
        self.assertEqual(mode, 'openai')
        self.assertEqual(fields['supplier_name']['value'], 'Cedar Works')
        self.assertEqual(network.call_args.kwargs['timeout'], 30)

class WorkflowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('reviewer', password='test-password')
        self.client.force_login(self.user)
        self.case = Case.objects.create(name='Synthetic supplier')

    def upload(self, kind):
        text = (Path(__file__).parent.parent / 'fixtures' / f'{kind}.txt').read_bytes()
        return self.client.post(f'/api/cases/{self.case.pk}/documents', {'kind': kind, 'file': SimpleUploadedFile(f'{kind}.txt', text)})

    def review(self, **data):
        return self.client.post(f'/api/cases/{self.case.pk}/review', json.dumps(data), content_type='application/json')

    def test_unauthenticated_api_is_denied(self):
        self.client.logout()
        self.assertEqual(self.client.get('/api/cases').status_code, 401)

    def test_csrf_enforced_for_writes_and_login(self):
        browser = Client(enforce_csrf_checks=True)
        browser.force_login(self.user)
        self.assertEqual(browser.post('/api/cases', '{}', content_type='application/json').status_code, 403)
        self.assertEqual(browser.post('/api/login', '{}', content_type='application/json').status_code, 403)

    def test_conflict_resolution_approval_and_audit_persist(self):
        for kind in ('registration', 'bank', 'form'):
            self.assertEqual(self.upload(kind).status_code, 201)
        response = self.client.get(f'/api/cases/{self.case.pk}').json()
        self.assertEqual(response['fields']['registration_number']['state'], 'conflict')
        self.assertFalse(response['ready'])
        self.assertEqual(self.review(decision='approved', reason='Checked source documents').status_code, 400)
        response = self.review(decision='approved', corrections={'registration_number': 'DEMO-2024-001'}, reason='Verified registration certificate over mistyped form')
        self.assertEqual(response.status_code, 200)
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, 'approved')
        self.assertEqual(self.case.corrections['registration_number'], 'DEMO-2024-001')
        self.assertEqual(Audit.objects.filter(case=self.case, action='approved').count(), 1)
        self.assertEqual(self.upload('bank').status_code, 400)
        self.assertEqual(self.review(decision='rejected', reason='Second decision').status_code, 400)

    @patch('onboarding.views.extract')
    def test_decided_or_missing_case_never_calls_model(self, model):
        self.case.status = 'rejected'
        self.case.save()
        self.assertEqual(self.upload('bank').status_code, 400)
        self.assertEqual(self.client.post('/api/cases/99999/documents', {'kind': 'bank', 'file': SimpleUploadedFile('bank.txt', b'Bank account: DEMO')}).status_code, 404)
        model.assert_not_called()

    def test_missing_documents_cannot_be_overridden_with_corrections(self):
        result = self.review(decision='approved', corrections={'supplier_name': 'Cedar', 'registration_number': 'D1', 'bank_account': 'D2'}, reason='Manual approval attempt')
        self.assertEqual(result.status_code, 400)
        self.case.refresh_from_db()
        self.assertEqual(self.case.corrections, {})

    def test_new_evidence_invalidates_corrections(self):
        self.upload('registration')
        self.assertEqual(self.review(decision='save', corrections={'registration_number': 'Verified'}, reason='Checked source').status_code, 200)
        self.upload('form')
        self.case.refresh_from_db()
        self.assertEqual(self.case.corrections, {})

    def test_rejection_requires_reason_but_accepts_incomplete_case(self):
        self.assertEqual(self.review(decision='rejected', reason='').status_code, 400)
        self.assertEqual(self.review(decision='rejected', reason='Required documents absent').status_code, 200)

    def test_malformed_review_rejected(self):
        for data in [{'corrections': []}, {'corrections': {'unknown': 'value'}}, {'corrections': {'supplier_name': 2}}, {'decision': 'anything'}]:
            self.assertEqual(self.review(reason='Document reviewed', **data).status_code, 400)

    def test_invalid_file_leaves_no_document_or_event(self):
        result = self.client.post(f'/api/cases/{self.case.pk}/documents', {'kind': 'bank', 'file': SimpleUploadedFile('bad.pdf', b'broken')})
        self.assertEqual(result.status_code, 400)
        self.assertEqual(self.case.documents.count(), 0)
        self.assertEqual(self.case.events.count(), 0)

    def test_case_name_validation_and_missing_case(self):
        self.assertEqual(self.client.post('/api/cases', json.dumps({'name': ' '}), content_type='application/json').status_code, 400)
        self.assertEqual(self.client.get('/api/cases/99999').status_code, 404)
