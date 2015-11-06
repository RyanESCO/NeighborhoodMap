var map;
var yelpResults;
var openWindow;
var geocoder;

var NeighborHoodMapViewModel = function(){
  var self = this;
  self.resultList = ko.observableArray();
  self.mapMarkers = ko.observableArray();
  self.searchLocation = ko.observable('');
  self.searchTerm = ko.observable('');
  self.numResults = ko.pureComputed(function() {
    return self.resultList().length;
  });
  
  self.filterResults = function() {
    var searchWord = self.filterKeyword().toLowerCase();
    var array = self.grouponDeals();
    if(!searchWord) {
      return;
    } else {
      self.filteredList([]);
      for(var i=0; i < array.length; i++) {
        if(array[i].dealName.toLowerCase().indexOf(searchWord) != -1) {
          self.mapMarkers()[i].marker.setMap(map);
          self.filteredList.push(array[i]);
        } else{
          for(var j = 0; j < array[i].dealTags.length; j++) {
            if(array[i].dealTags[j].name.toLowerCase().indexOf(searchWord) != -1) {
              self.mapMarkers()[i].marker.setMap(map);
              self.filteredList.push(array[i]);
          //otherwise hide all other markers from the map
          } else {
              self.mapMarkers()[i].marker.setMap(null);
            }
          }
          self.dealStatus(self.numDeals() + ' deals found for ' + self.filterKeyword());
        }
      }
    }
  },
  
  self.yelpSearch = function(formElement){
    self.centerMap(''+self.searchLocation()+'');
    
    parameters = [];
    parameters.push(['term', self.searchTerm()]);
    parameters.push(['location', self.searchLocation()]);
    parameters.push(['radius_filter', Yelp.defaultRadius]);
    parameters.push(['callback', 'self.searchSuccess']);
    parameters.push(['oauth_consumer_key',Yelp.auth.consumerKey]);
    parameters.push(['oauth_consumer_secret', Yelp.auth.consumerSecret]);
    parameters.push(['oauth_token', Yelp.auth.accessToken]);
    parameters.push(['oauth_signature_method', 'HMAC-SHA1']);
    
    var message = { 
      'action': 'http://api.yelp.com/v2/search',
      'method': 'GET',
      'parameters': parameters 
    };
  
    OAuth.setTimestampAndNonce(message);  
    
    (function() {
       Yelp.accessor.consumerSecret = Yelp.auth.consumerSecret;
       Yelp.accessor.tokenSecret = Yelp.auth.accessTokenSecret;
       
    })();
    
    OAuth.SignatureMethod.sign(message, Yelp.accessor);
  
    var parameterMap = OAuth.getParameterMap(message.parameters);
    parameterMap.oauth_signature = OAuth.percentEncode(parameterMap.oauth_signature);
    console.log(parameterMap);
    
    $.ajax({
      'url': message.action,
      'data': parameterMap,
      'cache': true,
      'dataType': 'jsonp',
      'jsonpCallback': 'success',
      'success': function(data, textStats, XMLHttpRequest) {
        self.searchSuccess(data);
      }
    }).fail(function() { self.searchFail();});
    
  },
  
  self.searchSuccess = function(results){
    if(!results) { 
      self.searchFail();
      return
    }
    
    yelpResults = results.businesses;
    map.setCenter({lat: results.region.center.latitude, lng: results.region.center.longitude});
    console.log({lat: results.region.center.latitude, lng: results.region.center.longitude});
    self.displayMarkers();   
  };
  
  self.searchFail = function(){
    console.log('failed!'); 
  },
  
  self.centerMap = function(zipCodeString){
    if(!geocoder) return;
    geocoder.geocode( { 'address': zipCodeString}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        //Got result, center the map and put it out there
        map.setCenter(results[0].geometry.location);
        console.log(results[0].geometry.location);
      } else {
        console.log("Geocode was not successful for the following reason: " + status);
      }
    });
    
  },
  
  self.displayMarkers = function(){
    //hide any existing markers
    self.clearMarkers(null);    
    for (var i = 0; i < yelpResults.length; i++) {
        var result = yelpResults[i];
        var marker = new google.maps.Marker({
          position: {lat: result.location.coordinate.latitude, lng: result.location.coordinate.longitude},
          map: map,
          animation: google.maps.Animation.DROP, 
          title: result.name
        });
                
        (function(selectedResult, marker){
          marker.addListener('click', function() {
            if(openWindow) {
              openWindow.close();
            }
            var infowindow = new google.maps.InfoWindow({
                content: personalizeContent(selectedResult)
            });                  
            infowindow.open(marker.map, marker);
            openWindow = infowindow;
            console.log(selectedResult.name);    
          });
        })(result, marker);
        
        self.mapMarkers().push(marker);
    }
    
  },
  
  // Sets the map on all markers in the array.
  self.setMapOnAll = function (map) {
    for (var i = 0; i < self.mapMarkers().length; i++) {
      self.mapMarkers()[i].setMap(map);
    }
  },

  // Removes the markers from the map, but keeps them in the array.
  self.clearMarkers = function () {
    setMapOnAll(null);
  }
}

ko.applyBindings(NeighborHoodMapViewModel);

function initializeMap() {
  
   geocoder = new google.maps.Geocoder();

    map = new google.maps.Map(document.getElementById('map'), {
        center: {
            lat: 45.375,
            lng: -122.633            
        },
        disableDefaultUI: true,
        zoom: 12
    });
   
}

function personalizeContent(result){
    var contentString = '<div id="resultsCards" class="mdl-shadow--8dp">'+
    '<div class="card-wide mdl-card mdl-shadow--2dp">'+
    '<div class="mdl-card__title" style="background: url(%URL%) center / cover;">'+
    '<h2 class="mdl-card__title-text">%PARKNAME%</h2>'+
    '</div>'+
    '<div class="mdl-card__supporting-text">"%SNIPPET%"</div>'+
    '<div class="mdl-card__actions mdl-card--border">'+
    '<a href="%READMORE%" target="_blank" class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect">'+
    'Read More'+
    '</a>'+
    '</div>'+
    '</div>'+
    '</div>';
    
    contentString = result.image_url ? contentString.replace("%URL%",result.image_url):contentString.replace("%URL%","");
    contentString = result.name ? contentString.replace("%PARKNAME%",result.name):contentString.replace("%PARKNAME%","");
    contentString = result.snippet_text ? contentString.replace("%SNIPPET%",result.snippet_text):contentString.replace("%SNIPPET%","");
    contentString = result.url ? contentString.replace("%READMORE%",result.url):contentString.replace("%READMORE%","");
    return contentString;
  
}

//var API_KEY = "AIzaSyDdiB_7OxmQOI61djUBR1Xwgr33x-h6XR8";
