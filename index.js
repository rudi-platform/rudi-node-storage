var express = require('express');
var httpServer = express();

function HttpService(port) {
    httpServer.get('/', function(req, res) { service.root(req, res) }.bind({'service':this}));
    httpServer.listen(p);
}

HttpService.prototype.root = function(req, res){
    res.send('<!DOCTYPE html>\
<html lang="en">\
  <head><meta charset="utf-8"><title>Lora Logging service</title></head>\
  <body><H1>Ask for a proper access method to the AQMO team at the University of Rennes 1</H1></body>\
</html>');
}

p = 3201;
if (argv["p"]) {
    var np = parseInt(argv["p"], 10);
    if (np != NaN) p = np;
}
else if (p < 80 ) {
    this.logger.info('Incorrect port provided: '+p);
    process.exit(-1);
}

service = new HttpService(p);
