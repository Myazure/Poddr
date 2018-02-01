angular.module('poddr').controller(
  "SearchController", function($scope, $http, $mdToast, RegionService){
    var storage = require('electron-json-storage');
    var itunesSearch = require('itunes-api-search');

    $scope.query = "";
    $scope.results = [];

    $scope.countries = RegionService.regions;
    $scope.region = "us";

    storage.get('region', function(error, data) {
      if (error) throw error;
      $scope.region = data.value;
      $scope.$apply();
    });

    $scope.isLoading = false;

    $scope.doSearch = function(){
      if($scope.query){
        $scope.results = [];
        $scope.isLoading = true;
        itunesSearch.search($scope.query, {
          entity: 'podcast',
          limit: '50',
          country: $scope.region
        }, function(err, res){
          if(err){
            console.log(err);
            return;
          }
          $scope.isLoading = false;
          $scope.results = res.results;
          $scope.$apply();
        })
      }
    }

    var storage = require('electron-json-storage');
    $scope.setFavourite = function(id, img, title, artist){
      var id = id.toString();
      storage.set(id,{
        'id': id,
        'title': title,
        'img': img,
        'artist': artist
      }, function(err){
        if(err){
          console.log(err);
        } else {
          $mdToast.show(
            $mdToast.simple()
              .textContent("You now follow " + artist)
              .position("top right")
              .hideDelay(3000)
              .toastClass('md-toast-success')
          );
        }
      });
    }

  });