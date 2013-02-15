/* Topcoat benchmark server */

var express = require('express')
  , fetch = require('./routes/fetch')
  , http = require('http')
  , mongoose = require('mongoose')
  , fs = require('fs')
  , schemes = require('./schemes')
  , path = require('path')
  , uaParser = require('ua-parser');

var app = express();
// var db = mongoose.connect('mongodb://localhost:27017/topcoat');
var db = mongoose.connect('mongodb://nodejitsu:9fc443c21383ecb58fbf5c05ae3d89b3@alex.mongohq.com:10059/nodejitsudb170514779432');

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.locals.pretty = true;
});

app.get('/', function(req, res){
	res.render('index', {
		title: 'Topcoat'
	});
});

app.get('/create', function (req, res) {
	
	var schema = schemes.test_scheme
	,	Test = db.model('Test', schema);
	
	Test.find().distinct('commit', function(err, docs){
		if(err)
			console.log(err);
		else {
			var l = docs.length;
			docs.forEach(function (commit) {
				Test.findOne({'commit' : commit}, function (err, doc) {
					var commitSchema = schemes.commitSchema
					,	Commit = db.model('Commit', commitSchema);

					var commitEntry = new Commit({
						commit  : commit,
						date	: doc.date
					});

					commitEntry.save(function (err) {
						if(err) {
							console.log(err);
							res.end('Error!');
						} else {
							console.log('saved');
							if(--l === 0) {
								res.end('Done');
							}
						}
					});

				});
			});
		}
	});

});

app.post('/benchmark', function(req, res){

	res.header("Access-Control-Allow-Origin", "*");
	
	var ua = uaParser.parse(req.body.ua)
	,	schema = schemes.test_scheme
	,	selector = schemes.selector
	,	Selector = db.model('Selector', selector)
	,	Test = db.model('Test', schema);

	var test = new Test({
		result: req.body.benchmark_result,
		commit : req.body.commit,
		date : req.body.date,
		os: ua.os.toString(),
		//version: ua.toVersionString(), //not working due to a bug in the latest ua-parser
		version: ua.major + "." + ua.minor + "." + ua.patch,
		browser: ua.family,
		device : req.body.device,
		test: req.body.test,
		ua: req.body.ua
	});

	if(req.body.selector && req.body.selector.length)
		req.body.selector.forEach(function (sel) {
			var s = new Selector({
				delta: sel.delta,
				selector: sel.selector,
				total: sel.total
			});
			test.selector.push(s);
		});
	
	test.save(function (err) {
		if (err)
			res.end('Error');
		else
			res.end('Submitted');
	});
});

app.get('/view/results', function(req, res){

	var commitSchema = schemes.commitSchema
	,	Commit = db.model('Commit', commitSchema);
	
	Commit.find().sort('-date').execFind(function (err, docs) {
		if(err)
			console.log(err);
		else {
			var months = ['Jan', 'Feb', 'Mar', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			docs.forEach(function (doc, idx) {
				var date = new Date(doc.date);
				docs[idx].formatedDate = months[date.getMonth()] + ' ' + date.getDate() + ' ' + date.getFullYear();
				docs[idx].miliseconds = date.getTime();
			});

			res.render('visualisations', {
				title: 'Visualisation menu',
				tests: docs
			});
		}
	});

});

app.get('/view/:commit', function (req, res) {

	var schema = schemes.test_scheme
	,	Test = db.model('Test', schema);

	Test.find({'commit' : req.params.commit}, function (err, docs) {
		if(err)
			console.log(err);
		else {
			var result = {};
			docs.forEach(function (d) {
				console.log(d.test);
				if(result[d.test]) {
					if(result[d.test][d.browser + ' ' + d.version + ' ' + d.os]) {
						result[d.test][d.browser + ' ' + d.version + ' ' + d.os].result += parseInt(d.result,10);
						result[d.test][d.browser + ' ' + d.version + ' ' + d.os].count++;
					} else {
						result[d.test][d.browser + ' ' + d.version + ' ' + d.os] = {
							result : parseInt(d.result, 10),
							count  : 1,
							id     : d._id
						};
					}
				}
				else {
					result[d.test] = {};
					result[d.test][d.browser + ' ' + d.version + ' ' + d.os] = {
						result  : parseInt(d.result, 10),
						count   : 1,
						id		: d._id
					};
				}
			});
			// console.log(docs);
			console.log(result);
			res.render('commit-view', {
				title: 'Viewing details for commit ' + req.params.commit.substring(0,7),
				commit: req.params.commit,
				result: result,
				results: docs
			});
		}
			
	});
});

app.get('/json/:what/:value', function(req, res){

	var schema = schemes.test_scheme
	,	Test = db.model('Test', schema)
	,	search = {};

	search[req.params.what] = req.params.value;
	Test.find(search)
		.select('test result browser device os commit ua')
		.exec(function(err, docs){
			if(err)
				console.log(err);
			else
				if (!docs.length)
					res.end('Got nothin\'');
				else {
					console.log(docs);
					res.json(docs);
				}
	});

});


var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on " + port);
});