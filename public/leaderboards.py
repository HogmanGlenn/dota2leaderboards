import requests
import json
import time
import os

os.chdir(os.path.dirname(os.path.realpath(__file__)))

regions = ['americas', 'europe', 'se_asia', 'china']
url_base = 'https://www.dota2.com/webapi/ILeaderboard/GetDivisionLeaderboard/v0001?division='
path = './data/'

for r in regions:
    try:
        os.makedirs(path + '/' + r)
    except OSError:
        pass

    url = url_base + r + '&leaderboard=0'
    data = requests.get(url).json()
    with open(os.path.join(path, r, 'v0001.json'), 'w') as f:
        json.dump(data, f)
    time.sleep(0.1)