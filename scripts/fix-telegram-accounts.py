import json

f = '/home/techla/.openclaw/openclaw.json'
c = json.load(open(f))
tg = c['channels']['telegram']
mt = tg.pop('botToken', '')
tg.pop('allowFrom', None)
tg.pop('groupPolicy', None)
tg.pop('pairingPolicy', None)
tg['dmPolicy'] = 'pairing'
a = {}
a['main'] = {'botToken': mt, 'dmPolicy': 'pairing'}
a['marketing-bot'] = {'botToken': '8661008612:AAFqQBmLP8LHRbPVzZmOR29ytLjRd91BjbE', 'dmPolicy': 'pairing'}
a['hr-bot'] = {'botToken': '8646332971:AAGVh2KmQ9LinX5krte9uHm3iR9tPc3sDzU', 'dmPolicy': 'pairing'}
a['bot-cskh'] = {'botToken': '8681729663:AAGlV-a8Q525MCetGEb14fcWBkMNtN1EXsQ', 'dmPolicy': 'pairing'}
tg['accounts'] = a
json.dump(c, open(f, 'w'), indent=2)
print('Done! 4 bot accounts with pairing.')
