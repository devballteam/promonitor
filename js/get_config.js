'use strict'

var config = localStorage.config

if (config) {
  try {
    config = JSON.parse(config)
  } catch (error) {
    location.href = 'config.html#parse-error'
  }
} else {
  location.href = 'config.html'
}
