var express = require('express');
var router = express.Router();
var Async = require('async');
var Promise = require('bluebird');
var HashMap = require('hashmap');
const followRedirects = require('follow-redirects');
const getUrls = require('get-urls');
var url = require('url');

// Maintains the key value pair of crawled url
var hashmap = new HashMap();

// Unparsed urls list
var unparsedUrls = [];

// Request a url, parse and find all the urls in it
var request = function(str){
    var urlObj = url.parse(str);
    var request;

    if(str.startsWith('https://')) request = followRedirects.https;
    else request = followRedirects.http;

    request.get(str,function (response) {
        var str = '';
        response.on("data",function(chunk){
            str+= chunk;
        });

        response.on("end",function(){
            console.log(str);
            unparsedUrls.concat(getUrls(str));
        });


    }).on('error', (e) => {
        console.error(e);
    });

}

//Async queue with two concurrent workers
var queue = Async.queue(request,2);


function crawlUrl(str) {
    queue.push(str);
}

/* GET home page. */
router.get('/', function(req, res, next) {

    var urlObj = url.parse("http://www.google.com");
    // urlObj.protoc
    // crawlSite("http://www.google.com");

    res.render('index', { title: 'Express' });
});

module.exports = router;
