import json

f = '/home/techla/.openclaw/openclaw.json'
c = json.load(open(f))
tg = c['channels']['telegram']

# Clean root level
for k in ['botToken', 'allowFrom', 'groupPolicy', 'pairingPolicy', 'groupAllowFrom']:
    tg.pop(k, None)

# Set accounts with pairing + open group policy
for aid, acct in tg.get('accounts', {}).items():
    acct['dmPolicy'] = 'pairing'
    acct['groupPolicy'] = 'open'
    acct.pop('allowFrom', None)
    acct.pop('groupAllowFrom', None)

# Remove stale default account if exists
if 'default' in tg.get('accounts', {}):
    del tg['accounts']['default']

json.dump(c, open(f, 'w'), indent=2)
print('Done! All accounts: pairing DM + open groups.')
