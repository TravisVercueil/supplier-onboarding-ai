import json
import time
from types import SimpleNamespace
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from onboarding.extraction import FIELDS, extract, assessment, validate_evidence
class Command(BaseCommand):
    help = 'Run a small synthetic baseline evaluation; no network or model cost.'
    def handle(self, *args, **options):
        fixtures = json.loads((settings.BASE_DIR / 'fixtures/evaluation.json').read_text())
        correct = total = exact = 0
        started = time.perf_counter()
        for item in fixtures:
            result, _ = extract(item['pages'], mode='baseline')
            validate_evidence(result, item['pages'])
            actual = {k: v['value'] for k, v in result.items()}
            for key in FIELDS:
                correct += actual.get(key) == item['expected'].get(key)
                total += 1
            exact += actual == item['expected']
            self.stdout.write(f"{'PASS' if actual == item['expected'] else 'MISS'} {item['name']}")
        conflict_results = []
        for second, expected in [('DEMO-001', 'matched'), ('DEMO-002', 'conflict')]:
            docs = [SimpleNamespace(pk=i, name=f'{i}.txt', kind='form', fields={'registration_number': {'value': value, 'page': 1, 'quote': f'Registration number: {value}'}}) for i, value in enumerate(['DEMO-001', second])]
            conflict_results.append(assessment(docs)['fields']['registration_number']['state'] == expected)
        self.stdout.write(f'Field-slot accuracy (including correctly absent): {correct}/{total} ({correct/total:.1%})')
        self.stdout.write(f'Exact documents: {exact}/{len(fixtures)}; conflict scenarios: {sum(conflict_results)}/{len(conflict_results)}')
        self.stdout.write(f'Elapsed: {(time.perf_counter()-started)*1000:.2f} ms; model calls: 0; model cost: $0')
        self.stdout.write('This is a tiny development fixture set, not held-out or production accuracy. Prose extraction is intentionally unsupported by the baseline.')
        if exact < 7 or not all(conflict_results):
            raise CommandError('Baseline regression against the seven supported-format fixtures.')
