import http.client, urllib.parse
from datetime import datetime, timedelta
import uuid
import json
import time
import sys, os
import logging
import jwt
import base64

# openssl req -x509 -nodes -newkey rsa:2048 -keyout private_key.pem -out public_key.pem -subj "/CN=rudiadmin.aqmo.org"

def dumps(obj, indent = 0):
    def isobj(obj): return (isinstance(obj, list) or isinstance(obj, dict))
    s = json.dumps(obj, separators=(',',':'))
    if len(s) < (78 - indent): return s
    indent += 4
    padb = r''
    padn = '\n'.ljust(indent+2)
    pade = '\n'.ljust(indent)
    padf = padb if isobj(obj) and (len(obj)>0) and isobj(list(obj)[0]) else padn
    if isinstance(obj, list):    return padb + '[' + padf + (','+padn).join([ dumps(i, indent) for i in obj ]) + pade + ']'
    elif isinstance(obj, dict):  return padb + '{' + padf + (','+padn).join([ (dumps(k, indent) + ':' + dumps(v, indent)) for k,v in obj.items() ]) + pade + '}'
    else: return str(obj)

class User(object):
    def __init__(self, name, uid = None, gid = None, privkeyfile = None, password = None):
        self.name = name
        self.group = 'auth'
        self.uid = uid if uid else str(uuid.uuid4())
        self.gid = gid if gid else str(uuid.uuid4())
        self.privkeyfile = None
        self.password = None
        self.cookie = None
        if privkeyfile and os.path.exists(privkeyfile):
            try: self.privkeyfile = open(privkeyfile, 'r').read()
            except Exception as e: pass
        elif password:
            try:
                password = base64.b64decode(password)
                self.password = base64.b64encode(self.name.encode(r'utf-8')+b':'+password).decode(r'ascii')
            except Exception as e: pass

    def setGroup(self, group):
        self.group = group

    def jwtData(self, group):
        now = datetime.now()
        offset = timedelta(seconds=5)
        #time.sleep(7)
        return {
            r'exp': (now + offset).strftime('%s'),
            r'jti': str(uuid.uuid4()),
            r'sub': group,
            r'client_id': self.name
        }

    def tokenapi_forge(self):
        """ 
        """
        #conn = self.conn(r'POST', r'/crypto/jwt/forge', self.user.jwtData())
        #return self.cresult(conn)
        pass

    def authHeader(self, group = None):
        if self.cookie:
            return { "Cookie": self.cookie }
        elif self.privkeyfile:
            if not group: group = self.group
            encoded_jwt = jwt.encode(self.jwtData(group), self.privkeyfile, algorithm="RS256")
            return { "Cookie": "rudi.media.auth=" + encoded_jwt }
        elif self.password:
            return { r'Authorization' : 'Basic %s' % (self.password) }
        else: return {}

class MediaClient(object):
    def __init__(self, user, host = "localhost", port = 3202, https = False, verify = True):
        self.user = user
        self.https = https
        self.host = host
        self.port = port
        if verify and not self.home():
            logging.error('Could not contact server '+host)
            sys.exit(-1)

    def execCmd(self, argv, params = None):
        qs = None
        return qs

    def helpCmd(self):
        def show(code, message):
            print('\t%s: %-20s' % (code, message))
        show('<nothing>', r'ask')

    def rawConn(self, https, host, port, ctype, path, body = None, headers = None, uheaders = {}):
        """ Interface for an easy request connexion 
        """
        try:
            if https: conn = http.client.HTTPSConnection(host, port)
            else:     conn = http.client.HTTPConnection(host, port)
            if not headers: headers = {"Content-Type": "text/plain", "Accept": "application/json" }
            for k in uheaders.keys(): headers[k] = uheaders[k]
            if body and type(body) == dict:
                headers[r'Content-Type'] = r'application/json'
                body = json.dumps(body)
            logging.warning("Request: %s: %s => %s"%(path, json.dumps(headers), body))
            if body: conn.request(ctype, path, body, headers)
            else:
                conn.putrequest(ctype, path)
                headers[r'Transfer-Encoding'] = r'chunked'
                for k, v in headers.items(): conn.putheader(k, v)
                conn.endheaders()
        except Exception as e:
            raise Exception("Server: "+str(e))
            print('Server not accessible: '+str(e))
            return None
        return conn

    def rawConnUrl(self, url, ctype, body = None, headers = None):
        pu = urllib.parse.urlparse(url)
        return self.rawConn(pu.scheme == 'https', pu.hostname, pu.port, ctype, pu.path, body, headers)

    def conn(self, ctype, path, body = None, headers = None, group = None):
        return self.rawConn(self.https, self.host, self.port, ctype, path, body, headers, self.user.authHeader())

    def cresult(self, conn, dump = True, raw = False):
        """ Basic parsing of the result
        """
        if not conn: return None
        response = conn.getresponse()
        conn.s_response = response
        conn.s_cookie = response.getheader(r'cookie')
        print(response.status, response.reason)
        if response.status == 200 or \
           response.status == 500 or \
           response.status == 501 or \
           (response.status >= 530 and response.status < 540) or \
           (response.status >= 400 and response.status < 500):
            if response.status == 200:
                if not raw:
                    rdata = response.read()
                    conn.close()
                    try: data = json.loads(rdata)
                    except Exception as e: data = repr(rdata)
                    if dump: print(dumps(data))
                    return data
                else: return response
            else:
                rdata = response.read()
                conn.close()
                try: data = json.loads(rdata)
                except Exception as e: data = repr(rdata)
                print(dumps(data))
        else: return None

    #
    # Ping
    #
    def home(self):
        """ Check if the Host is ready
        """
        conn = self.conn(r'GET', r'/')
        return self.cresult(conn)

    #
    # Main API
    #
    def askToken(self, user):
        conn = self.conn(r'POST', r'/jwt/forge', { r'user_id': user.uid, r'user_name': user.name, r'group_name': user.group })
        self.cresult(conn)
        user.cookie = conn.s_cookie
        return conn

    def logs(self):
        conn = self.conn(r'GET', r'/logs')
        return self.cresult(conn)

    def post(self, uuid, filename):
        if not uuid: uuid = str(uuid.uuid4())
        headers = { r'Content-Type': r'application/octet-stream', r'Accept': r'application/json',
                    r'file_metadata': json.dumps({
                        r'media_name': filename,
                        r'media_type': r'FILE',
                        r'media_id': uuid,
                        r'file_type': 'application/octet-stream',
                        r'charset': 'charset=binary',
                        #r'file_size': 0
                    })
        }
        try:
            with open(filename, 'rb') as fd:
                conn = self.conn(r'POST', r'/post', body=None, headers = headers)
                while chunk := fd.read(16000): conn.send((b'%x\r\n%s\r\n'%(len(chunk),chunk)))# ; print('.',end='');
                conn.send(b'0\r\n\r\n')
            return self.cresult(conn)
        except Exception as e: data = ''; print('Error posting data: '+str(e)) #; raise Exception()
        return ''

    def storage(self, link, outfilename, fzip = False):
        headers = {"Content-Type": "text/plain", "Accept": "application/json" }
        if fzip:   headers[r'media-access-compression'] = 'true'
        conn = self.rawConnUrl(link, r'GET', headers = headers)
        response = self.cresult(conn, False, True)
        if response:
            with open(outfilename, 'wb') as fd:
                while chunk := response.read(2000): fd.write(chunk)
            print('%s saved'%(outfilename))
            conn.close()

    def media(self, uuid, outfilename, method = None, fzip = False): # (Direct, Check)
        headers = {"Content-Type": "text/plain", "Accept": "application/json" }
        if method: headers[r'media-access-method'] = method
        if fzip:   headers[r'media-access-compression'] = 'true'
        conn = self.conn(r'GET', r'/'+uuid, headers = headers)
        if method == 'Direct':
            response = self.cresult(conn, False, True)
            with open(outfilename, 'wb') as fd:
                while chunk := response.read(2000): fd.write(chunk)
            print('%s saved'%(outfilename))
            conn.close()
        elif method != 'Check':
            data = self.cresult(conn)
            if not data: return ''
            if not r'url' in data: logging.error('Unexpected media connector: '+json.dumps(data))
            return self.storage(data[r'url'], outfilename, fzip)
        else: return self.cresult(conn)
        return ''

    def commit(self, stageId):
        if type(stageId) == list:
            if len(stageId) < 2: logging.error('Unexpected stage array: '+json.dumps(stageId))
            else: stageId = stageId[-2]
        if (not r'zone_name' in stageId) or (not r'commit_uuid' in stageId):
            logging.error('Unexpected stage descriptor: '+json.dumps(stageId))
            return
        headers = {"Content-Type": "text/plain", "Accept": "application/json" }
        conn = self.conn(r'POST', r'/commit/', stageId, headers = headers)
        return self.cresult(conn)

def main():
    rudimanager = User(r'rudimanager', privkeyfile = r'./adminpriv.pem')
    rudiconsole = User(r'rudiconsole', '1000')
    rudiadmin = User(r'rudiadmin', password = base64.b64encode(r'sysadminisgreat!'.encode('utf-8')))
    admin = User(r'admin', password = base64.b64encode(r'sysadminisgreat!'.encode('utf-8')))

    mcManager = None
    if True:
        mcManager = MediaClient(rudimanager)

    mcConsole = None
    if mcManager and True:
        rudiconsole.setGroup('producer')
        mcManager.askToken(rudiconsole)
        mcConsole = MediaClient(rudiconsole, verify = False)
        #mcConsole.logs()

    if mcConsole and True:
        mcConsole.media('8d784a62-5e20-4412-a3be-48ef85c073ec', '_OO', method = 'Check')
    if mcConsole and True:
        mcConsole.media('2b67bfd7-b7a2-40f8-bba0-56abbbbff054', '_OO')
    if mcConsole and mcManager and True:
        stageId = mcConsole.post('2b67bfd7-b7a2-40f8-bba0-56abbbbff054', 'zoom_amd64.deb')
        time.sleep(1)
        mcConsole.commit(stageId)
        time.sleep(2)
        mcManager.commit(stageId)
        mcConsole.media('2b67bfd7-b7a2-40f8-bba0-56abbbbff054', '_OO')
        mcConsole.media('2b67bfd7-b7a2-40f8-bba0-56abbbbff054', '_OO', method = 'Check')

    if False:
        mcAdmin = MediaClient(admin)
        #mcAdmin.logs()
        mcAdmin.post('2b67bfd7-b7a2-40f8-bba0-56abbbbff054', 'zoom_amd64.deb')

if __name__ == '__main__': main()
