/**
 * @typedef PointObject Specifies x y coordinates on a plane
 * @property {Number} x (float) x coordinate on plane
 * @property {Number} y (float) y coordinate on plane
 */

function ParticleImage(settings = {}) {
    const _this = this

    // DEFAULTS
    //-----------------------------------------------
    const defaults = {
        output: null,
        image: {
            width: 500,
            height: 500,
            alignH: 'center',
            alignV: 'center',
            contain: true,
        },
        canvas: {
            element: null,
            width: 500,
            height: 500,
            padding: {
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
            },
        },
        particles: {
            density: 8,
            shuffle: true,
            array: [],
            properties: {
                fill: '#000000',
                opacity: 1,
                radius: 3
            },
        },
        animation: {
            frames: 50,
            contain: true,
            moveFunction: 'linear',
            timingFunction: 'easeOut',
            propertyFunction: 'linear',
        }
    }

    let mergedSettings = mergeDeep(defaults, settings)

    this.output = mergedSettings.output
    this.image = mergedSettings.image
    this.canvas = mergedSettings.canvas
    this.particles = mergedSettings.particles
    this.animation = mergedSettings.animation

    //add canvas props/methods
    this.canvas.context = null
    this.canvas.clear = function () {
        this.context.clearRect(0, 0, this.width, this.height)
    }
    this.canvas.init = function () {
        this.element = this.element instanceof HTMLCanvasElement ? this.element : document.createElement('canvas')
        this.element.width = this.width
        this.element.height = this.height
        this.context = this.element.getContext('2d')
        if (_this.output) _this.output.appendChild(this.element)
    }

    //add image props / methods
    this.image.getContainedDimensions = function () {
        let { width, height } = this

        if (this.contain === true) {
            const padding = _this.canvas.padding
            const maxWidth = _this.canvas.width - padding.left - padding.right
            const maxHeight = _this.canvas.height - padding.top - padding.bottom

            const adjustedWidthRatio = Math.min(width, maxWidth) / width
            const adjustedHeightRatio = Math.min(height, maxHeight) / height
            const minAdjustmentRatio = Math.min(adjustedWidthRatio, adjustedHeightRatio)

            width *= minAdjustmentRatio
            height *= minAdjustmentRatio
        }

        return { width: width, height: height }
    }

    this.canvas.init()

    this._requestedFrame = null // id of the last requested animation frame

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

            _this.setParticles(transitionDataArr)
            _this.animate()
            if (typeof onload === 'function') onload(_this.particles.array)
        }
        imageObj.src = src
    }

    this.setParticles = function (transitionDataArr = []) {
        //if new particles are required, add them until there is enough
        let newParticles = []
        while (this.particles.array.length < transitionDataArr.length) {
            let particle = new this.Particle()
            this.particles.array.push(particle)
            newParticles.push(particle)
        }

        // get particles required for the transition
        let particlesToUse = transitionDataArr.length < this.particles.array.length
            ? getEvenlyDistributedSample(this.particles.array, transitionDataArr.length)
            : this.particles.array

        //shuffle transition data if this.particleShuffle = true
        transitionDataArr = this.particles.shuffle ? shuffleArray(transitionDataArr) : transitionDataArr

        // add transition data to required particles, otherwise prepare fade out
        let curTransitionDataIndex = 0
        this.particles.array.forEach(particle => {
            //if particle is not new, set to transition from current position and props
            if (!newParticles.includes(particle)) {
                particle.transitionData.fromProperties = particle.properties
                particle.transitionData.fromPoint = particle.point
            }
            if (particlesToUse.includes(particle)) {
                let transitionData = transitionDataArr[curTransitionDataIndex]
                particle.updateTransitionData({ toProperties: this.particles.properties })
                particle.updateTransitionData(transitionData)
                curTransitionDataIndex++
            } else {
                let fadeOutPoint = this.getRandomPoint({ maxDistance: 20, fromPoint: particle.point })
                fadeOutPoint = rotatePoint(fadeOutPoint, particle.getSpawnPoint(), .25)
                particle.prepareFadeOut(fadeOutPoint)
            }
        })
    }

    this.animate = function (transitionDataArr = null) {

        const { timingFunction, frames } = this.animation

        this.cancelAnimation()
        let curFrame = 0
        if (transitionDataArr) this.setParticles(transitionDataArr)

        const animateFrame = () => {
            this.canvas.clear()
            let completion = curFrame / frames
            let animationPosition = applyTimingFunction(completion, timingFunction)

            for (let i = 0; i < this.particles.array.length; i++) {
                let particle = this.particles.array[i]
                particle.setPropsToFramePosition(animationPosition)
                particle.draw()
            }
            curFrame++
            if (curFrame < frames) this._requestedFrame = requestAnimationFrame(animateFrame)
        }

        animateFrame()
    }

    this.getImageData = function (imageObj) {
        const { width, height } = this.image.getContainedDimensions()
        return getImageData(imageObj, width, height)
    }



    this.getImageShift = function () {
        //get x and y shift
        const imageDimensions = this.image.getContainedDimensions()
        const padding = this.canvas.padding

        const canvasWidth = this.canvas.width
        const canvasHeight = this.canvas.height
        const imageWidth = imageDimensions.width
        const imageHeight = imageDimensions.height

        const { alignH, alignV } = this.image

        let shiftX = 0,
            shiftY = 0

        if (alignH === 'left') shiftX = padding.left
        else if (alignH === 'center') shiftX = (canvasWidth - imageWidth) / 2
        else if (alignH === 'right') shiftX = canvasWidth - imageWidth - padding.right

        if (alignV === 'top') shiftY = padding.top
        else if (alignV === 'center') shiftY = (canvasHeight - imageHeight) / 2
        else if (alignV === 'bottom') shiftY = canvasHeight - imageHeight - padding.bottom

        return { shiftX: shiftX, shiftY: shiftY }
    }


    this.getParticleDataFromImage = function (imageData, includeColor = true) {
        const { width, height, data } = imageData
        const { shiftX, shiftY } = this.getImageShift()
        const { density } = this.particles

        let particleData = []
        for (let x = 0; x < width; x += density) {
            for (let y = 0; y < height; y += density) {
                let position = (x + y * width) * 4
                if (data[position + 3] > 128) {

                    let transitionData = {
                        toPoint: { x: x + shiftX, y: y + shiftY }
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
    this.getRandomPoint = function (options = {}) {

        const { width, height } = this.canvas
        const padding = this.canvas.padding
        const {
            maxDistance = null,
            fromPoint = null,
            contain = this.animation.contain
        } = options

        let minX = contain ? padding.left : 0,
            minY = contain ? padding.top : 0,
            maxX = contain ? width - padding.right : width,
            maxY = contain ? height - padding.bottom : height

        if (typeof maxDistance === 'number') {
            if (!isPointObject(fromPoint)) return void console.error('if setting a max distance, you must also specify a from point')
            minX = Math.max(fromPoint.x - maxDistance, minX)
            minY = Math.max(fromPoint.y - maxDistance, minY)
            maxX = Math.min(fromPoint.x + maxDistance, maxX)
            maxY = Math.min(fromPoint.y + maxDistance, maxY)
        }

        return {
            x: getRandomFloat(minX, maxX),
            y: getRandomFloat(minY, maxY)
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
        const spawnProperties = properties === null ? { ..._this.particles.properties } : properties
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
            context.arc(this.point.x, this.point.y, this.properties.radius, 0, Math.PI * 2, false)
            context.fill()
            context.globalAlpha = 1
        }

        this.setTransitionFromCurrent
        //fires each frame to update properties throughout transition
        this.setPropsToFramePosition = function (completion) {
            const { fromPoint, fromProperties, toPoint, toProperties } = this.transitionData
            const { moveFunction, propertyFunction } = _this.animation

            this.point = applyMoveFunction({
                fromPoint: fromPoint,
                toPoint: toPoint,
                completion: completion,
                randFloat: this.randFloat,
                spawnPoint: spawnPoint
            }, moveFunction)

            // Get transition values for properties
            this.properties = applyPropertyFunction({
                fromProperties: fromProperties,
                toProperties: toProperties,
                completion: completion,
                randFloat: this.randFloat
            }, propertyFunction)
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

        this.updateTransitionData = function (transitionData = {}) {
            const { fromPoint = {}, fromProperties = {}, toPoint = {}, toProperties = {} } = transitionData
            this.transitionData.fromPoint = { ...this.transitionData.fromPoint, ...fromPoint }
            this.transitionData.fromProperties = { ...this.transitionData.fromProperties, ...fromProperties }
            this.transitionData.toPoint = { ...this.transitionData.toPoint, ...toPoint }
            this.transitionData.toProperties = { ...this.transitionData.toProperties, ...toProperties }
        }

        this.prepareFadeIn(spawnPoint)
    }




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
        Object.keys(_this.particles.properties).forEach(prop => {
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
        if (!isObject(testVar)) return false

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

    function getRandomFloat(min, max) {
        return Math.random() * (max - min) + min
    }

    function isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item)
    }

    function mergeDeep(target, ...sources) {

        if (!sources.length) return target
        const source = sources.shift()

        if (isObject(target) && isObject(source)) {
            for (const key in source) {
                if (isObject(source[key]) && !(source[key] instanceof Element)) {
                    if (!target[key]) Object.assign(target, { [key]: {} })
                    mergeDeep(target[key], source[key])
                } else {
                    Object.assign(target, { [key]: source[key] })
                }
            }
        }
        return mergeDeep(target, ...sources)
    }
}
