import suggestionItemTemplate from './suggestionItem.html'
import moment from 'moment'

angular.module('beeline').directive('suggestionItem', [
  function () {
    return {
      restrict: 'E',
      replace: false,
      template: suggestionItemTemplate,
      link: function($scope, element, attr) {
        $scope.parseTime = function (time) {
          let hours = moment.duration(time).hours()
          let suffix = hours > 11 ? 'PM' : 'AM'
          hours = hours > 11 ? hours - 12 : hours
          const minutes = moment.duration(time).minutes()
          return hours + '.' + minutes + ' ' + suffix
        }
      }
    }
  },
])
