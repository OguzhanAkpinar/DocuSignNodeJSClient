var Service = require('node-windows').Service;

var svc = new Service({
  name:'DocusignWS',
  description: 'DocuSign API windows service',
  script: 'C:\\Github\\DocuSign\\index.js'
});


svc.on('install',function(){
  svc.start();
});

svc.install();