window.addEventListener('error', ((event, source, lineno, colno, error) => {
    alert(source + ' ' + lineno + ',' + colno + ': ' + error.message)
}))

const MIN_SPEED = 3 // km/h

function round(value, decimals = 0) {
    return Math.round(value * (10 ** decimals)) / (10 ** decimals)
}

function fmtHhMm(h, m) {
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m)
}

function fmtDuration(seconds, resolution = null) {
    const divmod = (x, y) => [Math.floor(x / y), x % y];
    let days = 0, hours = 0, mins = 0, secs = seconds;
    [mins, secs] = divmod(secs, 60);
    [hours, mins] = divmod(mins, 60);
    [days, hours] = divmod(hours, 24);
    switch (resolution) {
        case "d":
            hours = mins = secs = 0
            break
        case "h":
            mins = secs = 0
            break
        case "m":
            secs = 0
            break
        case "s":
            secs = Math.floor(secs)
            break
    }
    const fmtToken = (value, unit) => ((value > 0 ? value + unit + ' ' : ''))
    const result = fmtToken(days, 'd') + fmtToken(hours, 'h') + fmtToken(mins, 'm') + fmtToken(secs, 's')
    if (result.length > 0) {
        return result.trim()
    } else {
        return '0' + (resolution || 's')
    }
}

document.addEventListener('alpine:init', () => {
    Alpine.data('main', () => ({
        page: 'dashboard',
        error: '',
        speed: {
            minRide: MIN_SPEED, // km/h
            current: 0, // km/h
            max: 0, // km/h
            avg: 0, // km/h
            nowaitAvg: 0, // km/h
            timeseries: {
                cache: [],
                values: []
            }
        },
        time: {
            start: new Date(), // date
            update: null, // epoch number
            waitDuration: 0,  // secs
            tripDuration: 0,  // secs
            updateDelay: null, //secs
        },
        altitude: {
            current: null, // meter
            accuracy: null // meter
        },
        heading: null,  // 0.0-360.0 degrees
        positionAccuracy: null, // meter

        noSleep: null,

        init() {
            if (navigator.geolocation) {
                setInterval(() => {
                    const now = new Date()
                    this.time.tripDuration = (now.getTime() - this.time.start.getTime()) / 1000
                    if (this.time.update)
                        this.time.updateDelay = Math.floor((now.getTime() - this.time.update) / 1000)

                    if (!isNaN(this.speed.current)) {
                        this.speed.timeseries.cache.push(this.speed.current)

                        if (Math.floor(now.getTime() / 1000) % 5 === 0) {
                            if (this.speed.timeseries.cache.length > 0) {
                                const currentAvg = this.speed.timeseries.cache.reduce((sum, val) => sum + val, 0) / this.speed.timeseries.cache.length
                                this.speed.timeseries.values.push(currentAvg)
                                this.speed.timeseries.cache = []
                            }
                            if (this.speed.timeseries.values.length > 0) {
                                let sumTotal = 0, sumNoWait = 0, countNoWait = 0
                                for (const sp of this.speed.timeseries.values) {
                                    sumTotal += sp
                                    if (sp >= MIN_SPEED) {
                                        sumNoWait += sp
                                        countNoWait++
                                    }
                                }
                                this.speed.avg = sumTotal / this.speed.timeseries.values.length
                                this.speed.nowaitAvg = (sumNoWait / countNoWait) || 0
                            }
                        }

                        if (this.speed.current < MIN_SPEED) {
                            this.time.waitDuration++
                        }
                    }
                }, 1000)

                navigator.geolocation.watchPosition(({timestamp, coords}) => {
                    this.time.update = timestamp
                    this.speed.current = coords.speed * 3.6  // m/s to km/h
                    if (!this.speed.max || this.speed.current > this.speed.max) this.speed.max = this.speed.current
                    this.altitude.current = coords.altitude
                    this.altitude.accuracy = coords.altitudeAccuracy
                    this.heading = coords.heading
                    this.positionAccuracy = coords.accuracy
                }, err => {
                    this.error = err.message
                }, {
                    enableHighAccuracy: true,
                    timeout: 15_000
                })
            } else {
                alert("Geolocation is not supported by this browser.")
            }
        },
        fmtStartTime() {
            return fmtHhMm(this.time.start.getHours(), this.time.start.getMinutes())
        },
        fmtTripTime() {
            return fmtDuration(this.time.tripDuration, 'm')
        },
        fmtWaitTime() {
            return fmtDuration(this.time.waitDuration)
        },
        fmtUpdateDelay() {
            return fmtDuration(this.time.updateDelay) + ' ago'
        },
        fmtHeading() {
            const directions = ['N', 'NE', 'NE', 'NE', 'E', 'SE', 'SE', 'SE', 'S', 'SW', 'SW', 'SW', 'W', 'NW', 'NW', 'NW', 'N']
            return directions[round(this.heading / 22.5)]
        },
        fmtCurrentSpeed() {
            return round(this.speed.current)
        },
        fmtMaxSpeed() {
            return round(this.speed.max, 1).toLocaleString(undefined, {minimumFractionDigits: 1})
        },
        fmtAvgSpeed() {
            return round(this.speed.avg || 0, 1).toLocaleString(undefined, {minimumFractionDigits: 1})
        },
        fmtAvgNoWaitSpeed() {
            return round(this.speed.nowaitAvg || 0, 1).toLocaleString(undefined, {minimumFractionDigits: 1})
        },
        clamp(value, min, max) {
            return Math.min(Math.max(value, min), max)
        },
        toggleNoSleep() {
            if (this.noSleep) {
                this.noSleep.disable()
                this.noSleep = null
            } else {
                this.noSleep = new NoSleep()
                this.noSleep.enable()
            }
        }
    }))
})

window.addEventListener('load', async () => {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./sw.js');
        } catch (e) {
            console.error(e)
        }
    }
})
