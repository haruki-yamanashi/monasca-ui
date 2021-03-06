'use strict';
angular.module('monitoring.controllers', [])
    .constant('CHICKLET_TO_ICON', {
        'chicklet-error': '/monitoring/img/critical-icon.png',
        'chicklet-warning': '/monitoring/img/warning-icon.png',
        'chicklet-unknown': '/monitoring/img/unknown-icon.png',
        'chicklet-success': '/monitoring/img/ok-icon.png',
        'chicklet-notfound': '/monitoring/img/notfound-icon.png'
    })
    .controller('timestampPickerController',[
      "$scope", "$window", "$location",
      function($scope, $window, $location){
        var offset = getTimezoneOffset(),
            queryParams = urlParams()

        $scope.currentFormat = undefined
        $scope.currentOffset = undefined

        $scope.setUp = setUp;

        function setUp(currentFormat){
            if(currentFormat){
                $scope.currentFormat = currentFormat
            }
            $scope.$watch('currentFormat', onFormatChange)
            if(queryParams['ts_mode'] === 'bl'){
                $scope.currentOffset = queryParams['ts_offset']
            }
        }

         function onFormatChange(nval,oval){
           var location;

           if (nval !== '' && nval !== oval){
             location = $location.path();

             // overwrite to new values
             queryParams['ts_mode'] = nval;
             if(nval === 'utc'){
               queryParams['ts_offset'] = 0;
             } else {
               queryParams['ts_offset'] = offset;
             }

             location = location.concat('?', paramsToSearch(queryParams));

             $window.location = location;
           }
        }

        function urlParams(url) {
            url = url || window.location.href;
            if (!url || (url.indexOf("?") < 0 && url.indexOf("&") < 0)) {
                return {};
            }
            if (url.indexOf('#') > -1) {
                url = url.substr(0, url.indexOf('#'));
            }
            return urlDecode(url.substr(url.indexOf("?") + 1));
        }

        function paramsToSearch(queryParams){
            var str = '';

            angular.forEach(queryParams, function it(val, key){
                str = str.concat(key, '=', encodeURIComponent(val), '&');
            });

            str = str.substr(0, str.length-1);

            return str;
        }

        function urlDecode(string, overwrite) {
            var obj = {},
                pairs = string.split('&'),
                name,
                value;
            angular.forEach(pairs, function it(pair) {
                pair = pair.split('=');
                name = decodeURIComponent(pair[0]);
                value = decodeURIComponent(pair[1]);
                obj[name] = overwrite || !obj[name] ? value : [].concat(obj[name]).concat(value);
            });
            return obj;
        }

        function getTimezoneOffset() {
            var offset = new Date().getTimezoneOffset();
            var minutes = Math.abs(offset);
            var hours = Math.floor(minutes / 60);
            var prefix = offset < 0 ? "+" : "-";
            return prefix + hours;
        }

    }])
    .controller('monitoringController',[
      "$scope", "$http", "$timeout", "$location", "CHICKLET_TO_ICON",
      function ($scope, $http, $timeout, $location, CHICKLET_TO_ICON) {
        var base_url;

        $scope.fetchStatus = function(statics_url) {
            if(statics_url && !base_url){
                base_url = statics_url;
            }

            $http({method: 'GET', url: $location.absUrl().concat('status')}).
                success(function(data, status, headers, config) {
                  // this callback will be called asynchronously
                  // when the response is available
                    $scope._serviceModel = data.series;
               }).
                error(function(data, status, headers, config) {
                    $scope.stop();
                });

        };

        $scope.onTimeout = function(){
            mytimeout = $timeout($scope.onTimeout,10000);
            $scope.fetchStatus();
        };
        var mytimeout = $timeout($scope.onTimeout,10000);

        $scope.stop = function(){
            $timeout.cancel(mytimeout);
        };

    }])
    .controller('alarmEditController', [
      "$window", "$scope", "$http", "$timeout", "$q",
      function ($window, $scope, $http, $timeout, $q) {

        $scope.metrics = [];
        $scope.metricNames = []
        $scope.currentMetric = undefined;

        $scope.currentFunction = "max";
        $scope.currentComparator = ">";
        $scope.currentThreshold = 0;
        $scope.currentIsDeterministic = false;
        $scope.matchingMetrics = [];
        $scope.tags = [];
        $scope.matchByTags = [];

        $scope.possibleDimensions = function(query) {
            return $q(function(resolve, reject) {
                var dim = {}
                var dimList = []
                angular.forEach($scope.matchingMetrics, function(value, name) {
                    for (var key in value.dimensions) {
                        if (value.dimensions.hasOwnProperty(key)) {
                            var dimStr = key + "=" + value.dimensions[key]
                            if (dimStr.indexOf(query) === 0) {
                                dim[dimStr] = dimStr;
                            }
                        }
                    }
                });
                angular.forEach(dim, function(value, name) {
                    dimList.push(value);
                });
                resolve(dimList);
            });
        };

        $scope.possibleDimKeys = function(query) {
            return $q(function(resolve, reject) {
                var dimList = []
                angular.forEach($scope.matchingMetrics, function(value, name) {
                    for (var key in value.dimensions) {
                        if (key.indexOf(query) === 0) {
                            if (dimList.indexOf(key) < 0) {
                                dimList.push(key);
                            }
                        }
                    }
                });
                resolve(dimList);
            });
        }

        $scope.metricChanged = function() {
            if ($scope.defaultTag.length > 0) {
                $scope.tags = [{text: $scope.defaultTag}];
            }
            $scope.saveDimension();
        }

        $scope.saveExpression = function() {
            $('#expression').val($scope.formatDimension());
        }

        $scope.saveDimension = function() {
            $scope.saveExpression();

            var mm = []
            angular.forEach($scope.metrics, function(value, key) {
                if (value.name === $scope.currentMetric) {
                    var match = true;
                    for (var i = 0; i < $scope.tags.length; i++) {
                        var vals = $scope.tags[i]['text'].split('=');
                        if (value.dimensions[vals[0]] !== vals[1]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        mm.push(value)
                    }
                }
            });
            $scope.matchingMetrics = mm
            $scope.dimnames = ['name', 'dimensions'];
            $('#match').val($scope.formatMatchBy());
        }

        $scope.saveDimKey = function() {
            var matchByTags = []
            for (var i = 0; i < $scope.matchByTags.length; i++) {
                matchByTags.push($scope.matchByTags[i]['text'])
            }
            $('#id_match_by').val(matchByTags.join(','));
        }

        $scope.formatDimension = function() {
            var dim = '';
            angular.forEach($scope.tags, function(value, key) {
                if (dim.length) {
                    dim += ',';
                }
                dim += value['text'];
            })
            return $scope.currentFunction
                    + '('
                    + $scope.currentMetric
                    + '{' + dim + '}'
                    + ($scope.currentIsDeterministic ? ',deterministic' : '')
                    + ') '
                    + $scope.currentComparator
                    + ' '
                    + $scope.currentThreshold;
        }

        $scope.formatMatchBy = function() {
            var dimNames = {}
            for (var i = 0; i < $scope.matchingMetrics.length; i++) {
                for (var attrname in $scope.matchingMetrics[i].dimensions) { dimNames[attrname] = true; }
            }
            var matches = [];
            for (var attrname in dimNames) { matches.push(attrname); }
            return matches;
        }

        $scope.init = function(defaultTag) {

            if (defaultTag.length > 0) {
                $scope.tags = [{text: defaultTag}];
            }

            $scope.defaultTag = defaultTag;

            metrics = $window._alarm_edit_ctrl_metrics

            $scope.metrics = metrics && metrics.length ? metrics : [];
            $scope.metricNames = uniqueNames($scope.metrics, 'name');
            $scope.currentMetric = $scope.metricNames[0];

            $scope.saveDimension();
        }

        $scope.$on('$destroy', (function() {
            var detWatcher = $scope.$watch('currentIsDeterministic', function detWatcher(newValue, oldValue) {
                if(newValue != oldValue){
                    $scope.$emit('mon_deterministic_changed', newValue);
                }
            });
            return function() {
                // destroy watchers
                detWatcher();
            }
        }()));

        function uniqueNames(input, key) {
            var unique = {};
            var uniqueList = [];
            for(var i = 0; i < input.length; i++){
                if(typeof unique[input[i][key]] == "undefined"){
                    unique[input[i][key]] = "";
                    uniqueList.push(input[i][key]);
                }
            }
            return uniqueList.sort();
        }
    }])
    .controller('alarmNotificationFieldController', NotificationField);

function NotificationField($rootScope) {

    var vm = this;
    var allOptions = {};
    var oldUndetermined = {};

    vm.empty = true;
    vm.list = [];
    vm.select = {
        model:null,
        options:[]
    };
    vm.isDeterministic = false;


    vm.init = function(data){
        data = JSON.parse(data);
        vm.empty = data.length === 0;
        data.forEach(prepareNotify);
    };
    vm.add = function(){
        if(vm.select.model){
            vm.list.push(allOptions[vm.select.model]);

            removeFromSelect();
            vm.select.model = null;
        }
    };
    vm.remove = function(id){
        for(var i = 0;i<vm.list.length;i+=1){
            if(vm.list[i].id === id){
                vm.list.splice(i, 1);
                vm.select.options.push(allOptions[id]);
                break;
            }
        }
        vm.select.model = null;
        if (id in oldUndetermined) {
            delete oldUndetermined[id];
        }
    };

    $rootScope.$on('mon_deterministic_changed', onDeterministicChange)

    function prepareNotify(item){
        var selected = item[7]
        var notify = {
            id: item[0],
            label: item[1] +' ('+ item[2] +')',
            name: item[1],
            type: item[2],
            address: item[3],
            alarm: item[4],
            ok: item[5],
            undetermined: item[6]
        };
        allOptions[notify.id] = notify;
        if(selected){
            vm.list.push(notify);
        } else {
            vm.select.options.push(notify);
        }
    }

    function removeFromSelect(){
         var opts = vm.select.options;
         for(var i = 0;i<opts.length;i+=1){
            if(opts[i].id === vm.select.model){
                opts.splice(i, 1);
                break;
            }
         }
    }

    function onDeterministicChange(event, isDeterministic) {

        if (!(vm.list && vm.list.length)) {
            return;
        } else if (isDeterministic === vm.isDeterministic) {
            return;
        }

        vm.isDeterministic = isDeterministic;

        angular.forEach(vm.list, function(item) {
            if(!(item.id in oldUndetermined)){
                oldUndetermined[item.id] = [];
            }
            if (isDeterministic) {
                oldUndetermined[item.id] = item.undetermined;
                item.undetermined = !isDeterministic;
            } else {
                item.undetermined = oldUndetermined[item.id];
                delete oldUndetermined[item.id];
            }
        });
    }
}

NotificationField.$inject = ['$rootScope'];

angular.module('monitoring.filters', [])
    .filter('spacedim', function () {
        return function(text) {
            if (typeof text == "string")
                return text;
            return JSON.stringify(text).split(',').join(', ');
        }
    });
