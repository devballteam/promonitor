/**
 * Create timer out of given element.  Element will have [data-timer] attribute
 * with current time in minutes or seconds.  This value can be displayed using
 * 'after' or 'before' pseudo element using 'content: attr(data-timer);'.
 *
 * @constructor Timer
 * @param {HTMLElement} element
 */
function Timer (element) {
  this.element = element
  this.timeout
}

/**
 * @memeberof Timer
 * @param {Number} seconds - number of seconds to count down
 */
Timer.prototype.set = function (seconds) {
  clearTimeout(this.timeout)

  this.element.dataset.timer = seconds > 60 ?
    Math.round(seconds / 60) + 'm' :
    seconds + 's'

  if (seconds > 0) {
    this.timeout = setTimeout(function () {
      this.set(--seconds)
    }.bind(this), 1000)
  }
}
