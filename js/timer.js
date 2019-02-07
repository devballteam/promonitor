/**
 * Create timer that can count time up and donw in human readable form
 * @constructor Timer
 */
function Timer () {
  this.timeout
}

/**
 * Start timer
 * @memeberof Timer
 * @param {Boolean} increase=false - if true time will be increased
 * @param {Number} time - time in milliseconds
 * @param {Function} onChange - executed on each time change, new time value in first callback param
 * @param {Function} [onComplete] - executed when increase=false and time reach 0
 */
Timer.prototype.start = function (increase, time, onChange, onComplete) {
  clearTimeout(this.timeout)

  var divider = 0
  var suffix = ''

  if      (time < 60000)    { divider = 1000     ; suffix = 's' }
  else if (time < 3600000)  { divider = 60000    ; suffix = 'm' }
  else if (time < 86400000) { divider = 3600000  ; suffix = 'h' }
  else                      { divider = 86400000 ; suffix = 'd' }

  onChange(Math.floor(time / divider) + suffix)

  if (time > 0) {
    var newTime = time
    var delay = 1000

    if (increase) {
      delay = divider - (time % divider)
      newTime += delay
    } else {
      delay = time > divider ? (time % divider || divider) : 1000
      newTime -= delay
    }

    this.timeout = setTimeout(function () {
      this.start(increase, newTime, onChange, onComplete)
    }.bind(this), delay)
  } else if (onComplete) {
    onComplete()
  }
}

/**
 * Stop timer
 * @memeberof Timer
 */
Timer.prototype.stop = function () {
  clearTimeout(this.timeout)
}
