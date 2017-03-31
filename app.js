var moment = require('moment')
,	underscore = require('underscore')
,	express = require('express')
,   exphbs  = require('express-handlebars')
, 	geocoder = require('./geocoder.js')
, 	request = require('request')
,	path = require('path')
,	foursquare = require('node-foursquare-venues')('HCTQ22DNCZSOYJ1RQYVBQA2WGWWH5NLHZ1YUJWBECTSTD5PA', 'XVVE5R2WJZY5QKLIFDWPYW33TVONGDXU0KNZ3OH1PY1KKIQK');



// Yelp
var yelp = require("yelp").createClient({
  consumer_key: "4igIr_QG-fL53lXv0wA_0Q",
  consumer_secret: "NrcuZEhSCLpVFA4T6szlqR7NR-8",
  token: "FH34Z7Dv-NoPjP7SP7Rn2cq6A8fU_GT9",
  token_secret: "kTh5KUeIteGWmnHqtwI4-5Q1iCI"
});

// Express
var app = express();
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', exphbs({defaultLayout: 'main', extname: '.hbs'}));
app.set('view engine', '.hbs');
app.use(express.static(__dirname + '/public'));


// MongoDB
var MongoClient = require('mongodb').MongoClient;
//var dbURL = 'mongodb://localhost:27017/whatwait';
var dbURL = 'mongodb://aldo:39bann3r@104.131.164.212:27017/whatwait';



// insertPlace();
var insertPlace = function(id, db, callback) {
  var collection = db.collection('businesses');
  collection.insert(id, function(err, result) {
    callback(result);
  });
}

// root
app.get('/', function(req, res) {
	res.render('home');
});

// View Comments
app.get('/viewcomments/:id', function(req, res){
	var paramId = req.params.id;
	MongoClient.connect(dbURL, function(err, db) {
		var col = db.collection('businesses');
		col.findOne({_id: paramId}, function (err, doc){
			underscore.each(doc.comments, function(value){
				var temp = moment(value.timestamp).fromNow();
				value.timestamp  = temp;
			});
			res.json(doc);
		});
	});
});


// Add Comment
app.get('/addcomment/:id/:comment', function(req, res){
	var paramText = req.params.text,
		paramId = req.params.id,
		paramComment = req.params.comment;
		MongoClient.connect(dbURL, function(err, db) {
			var col = db.collection('businesses');
			col.findOne({_id: paramId}, function (err, doc){
				col.update({_id:paramId}, {$push: {comments: {text: paramComment, timestamp: moment().valueOf()}}}, function(err, result){
					//console.log(err);
				});
			});
		});
	res.redirect('/place/'+paramId);
});

// place:id (This route is only triggred after a comment is posted)
app.get('/place/:id', function(req, res){
	var hostURL = req.protocol + '://' + req.get('host');
	MongoClient.connect(dbURL, function(err, db) {
		var col = db.collection('businesses');
		col.findOne({_id: req.params.id}, function (err, doc){
			request(hostURL+'/viewcomments/'+paramId, function(error, response, body){
				var data = JSON.parse(body);
			res.render('place', {name: doc.details.name, id: paramId, comments: data.comments});
			});
		});
	});
});


// place:name:id (This route is initially called when a place is first selected)
app.get('/place/:name/:id', function(req, res){
	var paramName = req.params.name;
		paramId = req.params.id;
		initComments = [];
	var hostURL = req.protocol + '://' + req.get('host');
	// connect to db
	MongoClient.connect(dbURL, function(err, db) {
		var col = db.collection('businesses');

		// findOne
		col.findOne({_id: paramId}, function (err, doc){
			if(doc == null){
				//insertPlace
				insertPlace({_id: paramId, details: {name: paramName}, comments: []}, db, function(){
					db.close();
				});
				// fetch comments
				request(hostURL+'/viewcomments/'+paramId, function(error, response, body){
					var results = JSON.parse(body);
					res.render('place', {name: paramName, id: paramId, comments: results.comments});
				});

			} else {
				// fetch comments
				request(hostURL+'/viewcomments/'+paramId, function(error, response, body){
					var data = JSON.parse(body);
					res.render('place', {name: doc.details.name, id: paramId, comments: data.comments});
				});
			}
		});
	});// end MongoClient()
});






// find places on yelp
app.get('/places/:lat/:lng/:term', function(req, res){
	var hostURL = req.protocol + '://' + req.get('host');
	request({
			url:hostURL+'/search/'+req.params.lat+'/'+req.params.lng+'/'+req.params.term,
			json: true
		}, function (error, response, body){
		res.render('places', {businesses: body.businesses});
	});
});
app.get('/search/:lat/:lng/:term', function(req, res){
	geocoder.reverse(req.params.lat, req.params.lng, function(err, data) {
		var addressParts = data.results[0].formatted_address.split(','),
			location = addressParts[0]+','+addressParts[1]+''+addressParts[2];
			yelp.search({term: req.params.term, location: location, radius_filter: 5000}, function(error, data) {
			 res.json(data);
			}, req.params.lat+','+req.params.lng);
	});
});




// Foursquare Middleware
/*
	lat: 32.776664,
	lng: -96.796988
  http://crowdslike.com/api/venues/32.776664/-96.796988/4d4b7105d754a06376d81259
*/
app.get('/api/venues/:lat/:lng/:categoryid', function(req, res){

	var options = {
		limit: 15,
		term: "",
		location: {
			lat: req.params.lat,
			lng: req.params.lng
		},
		catid: req.params.categoryid
	};
	//4d4b7105d754a06376d81259
	foursquare.venues.search({ll:options.location.lat+","+options.location.lng, query:options.term, intent:"checkin", radius: 10046, /*limit: options.limit*,*/ categoryId: options.catid }, function(err, results){
		var tempVenuesArray= []; // temp variable to check for duplicate venues
		for (var i = 0; i < results['response']['venues'].length; i++){
			var fsqID = results['response']['venues'][i]['id'],
				fsqName = results['response']['venues'][i]['name'],
				fsqLocationLat = results['response']['venues'][i]['location']['lat'],
				fsqLocationLng = results['response']['venues'][i]['location']['lng'];
				tempVenuesArray.push({
					foursquareid: fsqID,
					name: fsqName,
					location:{
						lat: fsqLocationLat,
						lng: fsqLocationLng
					}
				});
		}
		var uniqVenueData = underscore.uniq(tempVenuesArray, function(item, key, a) {
			    return item.name
		});
		res.json(uniqVenueData);
	});
});



app.listen(5454);
console.log("server started at port 5454");
// https://maps.googleapis.com/maps/api/geocode/json?latlng=32.864066,-96.871102&key=AIzaSyDO_i4MdB-fJomY1-E-n4xud9atm6783ug
