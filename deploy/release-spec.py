"""Change only image references; preserve live domains, routes, scaling and secrets."""
import copy
import json
import os
import sys


def release_spec(spec, registry, tag):
    result = copy.deepcopy(spec)
    services = {s['name']: s for s in result.get('services', [])}
    if not {'town', 'web'} <= services.keys():
        raise ValueError('Existing production app must contain town and web')
    for name in ('town', 'web'):
        svc = services[name]
        if svc.get('instance_count') != 1 and name == 'town':
            raise ValueError('Town must have exactly one simulation instance')
        image = svc.get('image', {})
        if image.get('registry') != registry or image.get('repository') != f'unwatched-{name}':
            raise ValueError(f'Unexpected image source for {name}')
        svc['image'] = {**image, 'tag': tag}
        svc['image'].pop('digest', None)
        svc['image']['deploy_on_push'] = {'enabled': False}
    return result


if __name__ == '__main__':
    with open(sys.argv[1]) as source:
        spec = release_spec(json.load(source), os.environ['DO_REGISTRY'], os.environ['IMAGE_TAG'])
    with open(sys.argv[2], 'w') as target:
        json.dump(spec, target)
