const http = require('http');

const data = JSON.stringify({
  action: 'list-orders',
  raffleId: 'all',
  limitCount: 100
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin-action',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if(res.statusCode === 401) {
       console.log("Got 401, expected because no token. Good.");
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
