import requests, json, time, os
os.chdir(os.path.dirname(os.path.realpath(__file__)))

regions = ['americas', 'europe', 'se_asia', 'china']
url = 'https://www.dota2.com/webapi/ILeaderboard/GetDivisionLeaderboard/v0001?division={}&leaderboard=0'
path = './data/'
d = time.strftime('%Y-%m-%d')

for r in regions:
    os.makedirs(f'{path}/{r}', exist_ok=True)
    data = requests.get(url.format(r)).json()
    with open(os.path.join(path, f'{r}/v0001.json'), 'w') as f:
        json.dump(data, f)
    time.sleep(0.1)
