'use strict'

;(function (document, settings) {

  if (!settings) return // don't run reminder if not defined

  // Apply defaults
  if (!settings.hours)    settings.hours    = ["11:00"]
  if (!settings.duration) settings.duration = 1800000 // 30 min

  // Work In Progress
  // var hours = settings.hours.map(function (hour) {
  //   var hourParts = hour.split(':')
  // })

})(document, config.reminder)
