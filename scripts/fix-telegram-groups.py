import json

f = '/home/techla/.openclaw/openclaw.json'
c = json.load(open(f))
tg = c['channels']['telegram']

for aid, acct in tg.get('accounts', {}).items():
    acct['groupPolicy'] = 'open'
    acct['groups'] = {
        '*': {
            'requireMention': True,
            'groupPolicy': 'open'
        }
    }
    print(f'  {aid}: groupPolicy=open, groups.*=requireMention:true')

json.dump(c, open(f, 'w'), indent=2)
print('Done! All bots can respond in groups when mentioned (@botname).')
print('')
print('To make a bot respond WITHOUT mention, set requireMention: false')
print('Also: each bot needs privacy mode OFF or be admin in the group.')
print('  -> Open @BotFather -> /setprivacy -> choose bot -> Disable')
print('  -> Then remove and re-add bot to the group')
