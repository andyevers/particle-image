/**
 * @typedef PointObject Specifies x y coordinates on a plane
 * @property {Number} x (float) x coordinate on plane
 * @property {Number} y (float) y coordinate on plane
 */

function ParticleImage(settings) {
    const _this = this

    // DEFAULTS
    //-----------------------------------------------

    const {
        output = null,
        width = 500,
        height = 500,
        paddingX = 100,
        paddingY = 100,
        density = 5,
        frames = 100,
        particleShuffle = true, // randomizes order in which particles are given the transition properties provided
        particleProperties = {}, // default set below
        animationMoveFunction = 'linear',
        animationTimingFunction = 'easeOut',
        animationPropertyFunction = 'linear'
    } = settings

    if (width - paddingX <= 0) throw console.error('your paddingX must be less than the width')
    if (height - paddingY <= 0) throw console.error('your paddingY must be less than the height')

    this.output = output
    this.width = width
    this.height = height
    this.paddingX = paddingX
    this.paddingY = paddingY
    this.density = density
    this.frames = frames
    this.particleShuffle = particleShuffle
    this.animationMoveFunction = animationMoveFunction
    this.animationTimingFunction = animationTimingFunction
    this.animationPropertyFunction = animationPropertyFunction
    this.particleProperties = {
        fill: getOrDefault(particleProperties.fill, '#000000'),
        radius: getOrDefault(particleProperties.radius, 4),
        opacity: getOrDefault(particleProperties.opacity, 1)
    }

    this.particles = []

    this._requestedFrame = null // id of the last requested animation frame

    this.canvas = {
        element: null,
        context: null,
        clear: function () {
            this.context.clearRect(0, 0, _this.width, _this.height)
        },
        init: function () {
            this.element = document.createElement('canvas')
            this.element.width = _this.width
            this.element.height = _this.height
            this.context = this.element.getContext('2d')
            if (_this.output) _this.output.appendChild(this.element)
        }
    }

    this.cancelAnimation = function () {
        if (this._requestedFrame === null) return false
        cancelAnimationFrame(this._requestedFrame)
        this._requestedFrame = null
        return true
    }

    this.setParticlesToImage = function (src, useImageColor = true, onload = null) {
        const imageObj = new Image()
        imageObj.crossOrigin = 'anonymous'
        imageObj.onload = function (e) {
            const imageData = _this.getImageData(imageObj)
            let transitionDataArr = _this.getParticleDataFromImage(imageData, useImageColor)
            _this.setParticleTransitions(transitionDataArr)
            _this.animate()
            if (typeof onload === 'function') onload(this.particles)
        }
        imageObj.src = src
    }

    this.setParticleTransitions = function (transitionDataArr = []) {
        //if new particles are required, add them until there is enough
        let newParticles = []
        while (this.particles.length < transitionDataArr.length) {
            let particle = new this.Particle()
            this.particles.push(particle)
            newParticles.push(particle)
        }

        // get particles required for the transition
        let particlesToUse = transitionDataArr.length < this.particles.length
            ? getEvenlyDistributedSample(this.particles, transitionDataArr.length)
            : this.particles

        //shuffle transition data if this.particleShuffle = true
        transitionDataArr = this.particleShuffle ? shuffleArray(transitionDataArr) : transitionDataArr

        // add transition data to required particles, otherwise prepare fade out
        let curTransitionDataIndex = 0
        this.particles.forEach(particle => {
            if (!newParticles.includes(particle)) {
                particle.transitionData.fromProperties = particle.properties
                particle.transitionData.fromPoint = particle.point
            }
            if (particlesToUse.includes(particle)) {
                let transitionData = transitionDataArr[curTransitionDataIndex]
                particle.updateTransitionData({ toProperties: _this.particleProperties })
                particle.updateTransitionData(transitionData)
                curTransitionDataIndex++
            } else {
                let fadeOutPoint = this.getRandomPoint(20, particle.point)
                fadeOutPoint = rotatePoint(fadeOutPoint, particle.getSpawnPoint(), .25)
                particle.prepareFadeOut(fadeOutPoint)
            }
        })
    }

    this.animate = function (transitionDataArr = null) {

        this.cancelAnimation()
        let curFrame = 0
        if (transitionDataArr) this.setParticleTransitions(transitionDataArr)

        const animateFrame = () => {
            this.canvas.clear()
            let completion = curFrame / this.frames
            let animationPosition = applyTimingFunction(completion, this.animationTimingFunction)

            for (let i in this.particles) {
                let particle = this.particles[i]
                particle.setPropsToFramePosition(animationPosition)
                particle.draw()
            }
            curFrame++
            if (curFrame < this.frames) this._requestedFrame = requestAnimationFrame(animateFrame)
        }

        animateFrame()
    }

    this.getImageData = function (imageObj) {
        return getImageData(imageObj, _this.width - _this.paddingX, _this.height - _this.paddingY)
    }

    this.getParticleDataFromImage = function (imageData, includeColor = true) {
        const { width, height, data } = imageData
        let particleData = []

        for (let x = 0; x < width; x += this.density) {
            for (let y = 0; y < height; y += this.density) {
                let position = (x + y * width) * 4
                if (data[position + 3] > 128) {

                    let transitionData = {
                        toPoint: { x: x, y: y }
                    }
                    if (includeColor) {
                        let r = data[position],
                            g = data[position + 1],
                            b = data[position + 2]

                        transitionData.toProperties = {
                            fill: rgbToHex(r, g, b)
                        }
                    }
                    particleData.push(transitionData)
                }
            }
        }
        return particleData

    }

    /**
     * Gets a random point on canvas within the padding of the canvas
     * @returns {PointObject} random {x, y} 
     */
    this.getRandomPoint = function (maxDistance = null, fromPoint = null) {
        const constrainRange = (val, min, max) => Math.max(Math.min(val, max), min)

        if (maxDistance) {
            fromPoint = isPointObject(fromPoint) ? fromPoint : { x: this.width / 2, y: this.height / 2 }
            let x = fromPoint.x + getRandomFloat(maxDistance * -1, maxDistance)
            let y = fromPoint.y + getRandomFloat(maxDistance * -1, maxDistance)
            x = Math.round(constrainRange(x, 0, this.width - this.paddingX))
            y = Math.round(constrainRange(y, 0, this.height - this.paddingY))
            return { x: x, y: y }
        }
        return {
            x: Math.round(getRandomFloat(0, this.width - this.paddingX)),
            y: Math.round(getRandomFloat(0, this.height - this.paddingY))
        }
    }

    this.animateToImage = function (src, useImageColor = true) {
        this.setParticlesToImage(src, useImageColor, () => {
            _this.animate()
        })
    }


    // PARTICLE OBJECT
    //-----------------------------------------------

    this.Particle = function (point = null, properties = null) {

        const spawnPoint = isPointObject(point) ? point : _this.getRandomPoint()
        const spawnProperties = properties === null ? { ..._this.particleProperties } : properties
        const context = _this.canvas.context

        this.point = spawnPoint // { x: 30.43, y: 21.22 }
        this.properties = spawnProperties // { fill, opacity, radius }
        this.getSpawnPoint = () => spawnPoint
        this.getSpawnProperties = () => spawnProperties

        this.transitionData = {
            fromPoint: spawnPoint,
            fromProperties: spawnProperties,
            toPoint: spawnPoint,
            toProperties: spawnProperties
        }

        //used to add variation in the movement function for each particle
        this.randFloat = getRandomFloat(-1, 1)

        //puts the particle on canvas
        this.draw = function () {
            context.globalAlpha = this.properties.opacity
            context.fillStyle = this.properties.fill
            context.beginPath()
            context.arc(this.point.x + _this.paddingX / 2, this.point.y + _this.paddingY / 2, this.properties.radius, 0, Math.PI * 2, false)
            context.fill()
            context.globalAlpha = 1
        }

        this.setTransitionFromCurrent
        //fires each frame to update properties throughout transition
        this.setPropsToFramePosition = function (completion) {
            const { fromPoint, fromProperties, toPoint, toProperties } = this.transitionData

            this.point = applyMoveFunction({
                fromPoint: fromPoint,
                toPoint: toPoint,
                completion: completion,
                randFloat: this.randFloat,
                spawnPoint: spawnPoint
            }, _this.animationMoveFunction)

            // Get transition values for properties
            this.properties = applyPropertyFunction({
                fromProperties: fromProperties,
                toProperties: toProperties,
                completion: completion,
                randFloat: this.randFloat
            }, _this.animationPropertyFunction)
        }

        this.prepareFadeOut = function (toPoint = null) {
            const point = isPointObject(toPoint) ? toPoint : _this.getRandomPoint()
            this.updateTransitionData({
                toPoint: point,
                toProperties: {
                    opacity: 0,
                    radius: 0
                }
            })
        }

        this.prepareFadeIn = function (toPoint = null) {
            const point = isPointObject(toPoint) ? toPoint : _this.getRandomPoint()
            this.updateTransitionData({
                fromPoint: point,
                fromProperties: {
                    opacity: 0,
                    radius: 0
                }
            })
        }

        this.resetProperties = function () {
            this.properties = _this.particleProperties
        }

        this.updateTransitionData = function (transitionData = {}) {
            const { fromPoint = {}, fromProperties = {}, toPoint = {}, toProperties = {} } = transitionData
            this.transitionData.fromPoint = { ...this.transitionData.fromPoint, ...fromPoint }
            this.transitionData.fromProperties = { ...this.transitionData.fromProperties, ...fromProperties }
            this.transitionData.toPoint = { ...this.transitionData.toPoint, ...toPoint }
            this.transitionData.toProperties = { ...this.transitionData.toProperties, ...toProperties }
        }

        this.prepareFadeIn(spawnPoint)
    }

    this.canvas.init()


    // PRIVATE METHODS
    //-----------------------------------------------

    function getImageData(image, width = null, height = null) {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        canvas.width = typeof width === 'number' ? width : image.width
        canvas.height = typeof height === 'number' ? height : image.height

        const hRatio = canvas.width / image.width
        const vRatio = canvas.height / image.height
        const ratio = Math.min(hRatio, vRatio);

        //center image
        const centerShiftX = ((canvas.width - image.width * ratio) / 2)
        const centerShiftY = ((canvas.height - image.height * ratio) / 2)

        context.drawImage(
            image,
            0,
            0,
            image.width,
            image.height,
            centerShiftX,
            centerShiftY,
            image.width * ratio,
            image.height * ratio
        )
        return context.getImageData(0, 0, canvas.width, canvas.height)
    }

    function getEvenlyDistributedSample(arr, samples) {
        let results = [arr.shift()], // add first item
            interval = arr.length / samples
        for (let i = 1; i < samples - 1; i++) {
            results.push(arr[Math.floor(i * interval)]);
        }
        results.push(arr.pop()) //add last item
        return results
    }

    function rgbToHex(r, g, b) {
        function componentToHex(c) {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }
        return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }

    function applyPropertyFunction(settings, func) {
        const { toProperties, fromProperties, completion, randFloat } = settings
        const booster = 1 - (Math.abs(.5 * completion) * 2) // = 0 when completion = 0 or 1 and 1 when completion = .5.

        let betweenValues = []
        Object.keys(_this.particleProperties).forEach(prop => {
            let transitionVal = getTransitionValue(fromProperties[prop], toProperties[prop], completion)
            betweenValues[prop] = transitionVal
        })

        const propertyFunctions = {
            linear: function () {
                return betweenValues
            },
            bubble: function () {
                betweenValues.radius += booster * Math.min(Math.abs((booster * randFloat) * toProperties.radius), toProperties.radius * 1.5)
                return betweenValues
            }
        }

        const propertyFunction = 'function' === typeof func ? func : propertyFunctions[func]
        if ('function' !== typeof propertyFunction) console.error(`couldn\'t find property function: ${propertyFunction}`)
        return propertyFunction(settings)
    }

    // Returns {x, y} coordinates
    function applyMoveFunction(settings, func) {
        const { toPoint, fromPoint, completion, randFloat, spawnPoint } = settings
        const booster = 1 - (Math.abs(.5 * completion) * 2) // = 0 when completion = 0 or 1 and 1 when completion = .5.

        // Point if going directly in straight line between fromPoint and toPoint
        const betweenPoint = {
            x: getTransitionNumber(fromPoint.x, toPoint.x, completion),
            y: getTransitionNumber(fromPoint.y, toPoint.y, completion),
        }

        const moveFunctions = {
            linear: function () {
                return betweenPoint
            },
            rotate: function () {
                let rotPoint = rotatePoint(betweenPoint, toPoint, completion),
                    xBoost = (spawnPoint.x * randFloat) * booster,
                    yBoost = (spawnPoint.y * randFloat) * booster

                return {
                    x: getTransitionNumber(betweenPoint.x, rotPoint.x + xBoost, completion),
                    y: getTransitionNumber(betweenPoint.y, rotPoint.y + yBoost, completion)
                }
            }
        }

        const moveFunction = 'function' === typeof func ? func : moveFunctions[func]
        if ('function' !== typeof moveFunction) console.error(`couldn\'t find move function: ${moveFunction}`)
        return moveFunction(settings)
    }

    // returns adjusted percent between 0 and 1
    function applyTimingFunction(percent, func) {
        const timingFunctions = {
            easeOut: num => 1 - Math.pow(1 - num, 3),
            linear: num => num
        }

        const timingFunction = 'function' === typeof func ? func : timingFunctions[func]
        if ('function' !== typeof timingFunction) console.error(`couldn\'t find timing function: ${timingFunction}`)
        return timingFunction(percent)
    }


    /**
     * True if is object containing keys x, y
     */
    function isPointObject(testVar) {
        const isObject = 'object' === typeof testVar
            && null !== testVar
            && !Array.isArray(testVar)

        if (!isObject) return false

        const keys = Object.keys(testVar)
        return keys.length === 2 && keys.includes('x') && keys.includes('y')
    }

    /**
     * Returns value between of two vals. Accepts hex color strings and numbers, otherwise returns to arg
     */
    function getTransitionValue(from, to, completion) {

        const isUndefined = val => typeof val === 'undefined'
        const isHexColor = val => /^#[0-9A-F]{6}$/i.test(val)
        const isNumber = val => typeof val === 'number'

        if (isNumber(from) && isNumber(to)) return getTransitionNumber(from, to, completion)
        if (isHexColor(from) && isHexColor(to)) return getTransitionColor(from, to, completion)
        if (isUndefined(to)) return from
        return to
    }

    /**
     * Returns number between two nums
     * @param completion 0 = fromNum and 1 = toNum
     * @returns {Number} float, ex: 0.239
     */
    function getTransitionNumber(fromNum, toNum, completion = .5) {
        let distance = toNum - fromNum
        return fromNum + distance * completion
    }

    function shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]
            ];
        }

        return array;
    }

    /**
     * Returns color between two hex colors
     * @param completion location between hex where 0 = fromHex and 1 = toHex
     * @returns {String} Hex color, ex: #EC0000
     */
    function getTransitionColor(fromHex, toHex, completion = .5) {

        fromHex = fromHex.substring(1)
        toHex = toHex.substring(1)

        const hex = (color) => {
            const colorString = color.toString(16);
            return colorString.length === 1 ? `0${colorString}` : colorString;
        }

        const r = Math.ceil(
            parseInt(toHex.substring(0, 2), 16) * completion
            + parseInt(fromHex.substring(0, 2), 16) * (1 - completion)
        )
        const g = Math.ceil(
            parseInt(toHex.substring(2, 4), 16) * completion
            + parseInt(fromHex.substring(2, 4), 16) * (1 - completion)
        )
        const b = Math.ceil(
            parseInt(toHex.substring(4, 6), 16) * completion
            + parseInt(fromHex.substring(4, 6), 16) * (1 - completion)
        )

        return `#${hex(r) + hex(g) + hex(b)}`
    }

    /**
     * 
     * @param {PointObject} pointXY Point to be rotated
     * @param {PointObject} originXY Point that the poinXY will be rotated around
     * @param {*} angle 
     * @returns 
     */
    function rotatePoint(pointXY, originXY, angle) {
        let s = Math.sin(angle)
        let c = Math.cos(angle)

        pointXY.x -= originXY.x
        pointXY.y -= originXY.y

        let xNew = pointXY.x * c - pointXY.y * s
        let yNew = pointXY.x * s + pointXY.y * c

        pointXY.x = xNew + originXY.x
        pointXY.y = yNew + originXY.y

        return pointXY
    }
    function getOrDefault(val, fallback) {
        return typeof val === 'undefined' ? fallback : val
    }

    function getRandomFloat(min, max) {
        return Math.random() * (max - min) + min
    }
}
