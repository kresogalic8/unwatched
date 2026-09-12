import importlib.util
import pathlib
import unittest

loader = importlib.util.spec_from_file_location('release_spec', pathlib.Path(__file__).with_name('release-spec.py'))
module = importlib.util.module_from_spec(loader)
loader.loader.exec_module(module)


class ReleaseSpecTest(unittest.TestCase):
    def fixture(self):
        return {'domains': [{'domain': 'unwatched.world'}], 'ingress': {'rules': []}, 'envs': [{'key': 'GLOBAL', 'value': 'KEEP'}], 'services': [
            {'name': name, 'instance_count': 1, 'instance_size_slug': 'keep-size', 'envs': [{'key': 'SECRET', 'value': 'ENCRYPTED', 'type': 'SECRET'}], 'image': {'registry_type': 'DOCR', 'registry': 'unwatched', 'repository': f'unwatched-{name}', 'tag': 'old', 'digest': 'old-digest'}} for name in ('town', 'web')]}

    def test_preserves_live_settings_without_mutating_input(self):
        original = self.fixture()
        updated = module.release_spec(original, 'unwatched', 'v0.9.0-sha')
        self.assertEqual(updated['domains'], original['domains'])
        self.assertEqual(updated['ingress'], original['ingress'])
        self.assertEqual(updated['envs'], original['envs'])
        for before, after in zip(original['services'], updated['services']):
            self.assertEqual(before['image']['tag'], 'old')
            self.assertEqual(after['image']['tag'], 'v0.9.0-sha')
            self.assertNotIn('digest', after['image'])
            self.assertEqual(after['envs'], before['envs'])
            self.assertEqual(after['instance_size_slug'], before['instance_size_slug'])

    def test_rejects_wrong_registry_missing_service_or_multiple_simulations(self):
        for case in ('registry', 'service', 'instances'):
            spec = self.fixture()
            if case == 'registry': spec['services'][0]['image']['registry'] = 'another-project'
            if case == 'service': spec['services'].pop()
            if case == 'instances': spec['services'][0]['instance_count'] = 2
            with self.assertRaises(ValueError): module.release_spec(spec, 'unwatched', 'new')


if __name__ == '__main__': unittest.main()
