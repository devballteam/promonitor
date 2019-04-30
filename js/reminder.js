'use strict'

;(function(document, settings) {

  // Don't run reminder if not defined
  if (!settings) return

  // Apply defaults
  if (!settings.hours)    settings.hours    = ["11:00", "14:00"]
  if (!settings.duration) settings.duration = 1800000 // 30 min
  if (!settings.message)  settings.message  = 'It\'s time to review Pull Requests.'

  document.getElementById('reminder-custom-message').textContent = settings.message

  settings.hours = settings.hours
    .map(function(hour) {
      var timeParts = hour.split(':')
      var date = new Date()

      date.setHours   (Number(timeParts[0]))
      date.setMinutes (Number(timeParts[1]))
      date.setSeconds (0)

      return date
    })
    .sort(function(a, b) {
      return a.getTime() - b.getTime()
    })

  var reminderMessageElement      = document.getElementById('reminder-message')
  var reminderMessageTimerElement = document.getElementById('reminder-message-timer')
  var reminderTimerElement        = document.getElementById('reminder-timer')
  var reminderMessageTimer        = new Timer()
  var reminderTimer               = new Timer()

  ;(function showReminder(hoursIndex) {
    var currentDate  = new Date()
    var reminderDate = new Date()
    var day = currentDate.getDate()

    // Start new loop (add one day to date)
    if (hoursIndex >= settings.hours.length) {
      hoursIndex = 0
      day++
    }

    reminderDate.setDate    (day)
    reminderDate.setHours   (settings.hours[hoursIndex].getHours())
    reminderDate.setMinutes (settings.hours[hoursIndex].getMinutes())
    reminderDate.setSeconds (settings.hours[hoursIndex].getSeconds())

    var delay = reminderDate.getTime() - currentDate.getTime()

    // Skip this remainder because it's from the past
    if (delay <= 0) {
      showReminder(hoursIndex + 1)
      return
    }

    reminderTimer.start(
      false, delay,
      function(time) {
        reminderTimerElement.dataset.timer = time
      },
      function (hoursIndex) {
        showReminder(hoursIndex + 1)
        reminderMessageElement.hidden = false
        reminderMessageTimer.stop()
        reminderMessageTimer.start(false, settings.duration, function(time) {
          reminderMessageTimerElement.dataset.timer = time
        }, function() { reminderMessageElement.hidden = true })
      }.bind(null, hoursIndex)
    )
  })(0)

})(document, config.reminder)
