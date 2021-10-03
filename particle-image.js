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
        particleFill = '#000000',
        particleCount = 2000,
        particleRadius = 3,
        animationFrames = 100,
        animationMoveFunction = 'linear',
        animationTimingFunction = 'easeOut',
    } = settings

    this.output = output
    this.width = width
    this.height = height
    this.paddingX = paddingX
    this.paddingY = paddingY
    this.particleFill = particleFill
    this.particleCount = particleCount
    this.particleRadius = particleRadius
    this.animationFrames = animationFrames
    this.animationMoveFunction = animationMoveFunction
    this.animationTimingFunction = animationTimingFunction

    this.particles = []

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

    this.drawParticles = function () {
        _this.canvas.clear()
        _this.particles.forEach(p => p.draw())
    }

    this.animateParticles = function (properties) {
        let curFrame = 0

        // saves the original props and destination props in transitionData
        for (let i in properties) {
            let props = properties[i]
            let particle = this.particles[i]
            particle.prepareTransition(props)
        }

        const animateFrame = () => {
            this.canvas.clear()
            let completion = curFrame / this.animationFrames
            let animationPosition = applyTimingFunction(completion, this.animationTimingFunction)

            for (let i in properties) {
                let particle = this.particles[i]
                particle.setTransitionProps(animationPosition)
                particle.draw()
            }

            curFrame++
            if (curFrame < this.animationFrames) requestAnimationFrame(animateFrame)
        }

        animateFrame()
    }

    this.getImageData = function (imageObj) {
        return getImageData(imageObj, _this.width - _this.paddingX, _this.height - _this.paddingY)
    }

    this.getParticlePositions = function (imageData) {
        const pixelPositions = getPixelPositions(imageData)
        const particlePositions = getEvenlyDistributedSample(pixelPositions, this.particleCount)
        return particlePositions
    }

    this.setParticlesToImage = function (src) {
        const imageObj = new Image()
        imageObj.crossOrigin = 'anonymous'
        imageObj.onload = function (e) {
            const imageData = _this.getImageData(imageObj)
            const particlePositions = _this.getParticlePositions(imageData)
            _this.animateParticles(particlePositions)
        }
        imageObj.src = src
    }


    // PARTICLE OBJECT
    //-----------------------------------------------


    this.Particle = function (props) {
        const { x, y, r, fill } = props
        const context = _this.canvas.context

        const getOrDefault = (val, fallback) => typeof val === 'undefined' ? fallback : val

        this.x = x
        this.y = y
        this.r = r
        this.fill = fill
        this.transitionData = {
            from: { x: x, y: y, r: r, fill: fill },
            to: { x: x, y: y, r: r, fill: fill }
        }

        //used to add variation in the movement function for each particle
        this.moveMultiplier = getRandomFloat(-1, 1)

        //puts the particle on canvas
        this.draw = function () {
            context.fillStyle = _this.particleFill
            context.beginPath()
            context.arc(this.x + _this.paddingX / 2, this.y + _this.paddingY / 2, this.r, 0, Math.PI * 2, false)
            context.fill()
        }

        //fires each frame to update properties throughout transition
        this.setTransitionProps = function (completion) {
            const { from, to } = this.transitionData

            let { x, y } = applyMoveFunction({
                from: from,
                to: to,
                completion: completion,
                multiplier: this.moveMultiplier
            }, _this.animationMoveFunction)

            this.x = x
            this.y = y
            this.r = getTransitionNumber(from.r, to.r, completion)
            this.fill = getTransitionColor(from.fill, to.fill, completion)
        }

        this.prepareTransition = function (newProps) {
            this.transitionData = {
                from: {
                    x: this.x,
                    y: this.y,
                    r: this.r,
                    fill: this.fill
                },
                to: {
                    x: getOrDefault(newProps.x, this.x),
                    y: getOrDefault(newProps.y, this.y),
                    r: getOrDefault(newProps.r, this.r),
                    fill: getOrDefault(newProps.fill, this.fill)
                }
            }
        }
    }

    this.canvas.init()
    for (let i = 0; i < settings.particleCount; i++) {
        this.particles.push(new this.Particle({
            x: 0,
            y: 0,
            r: this.particleRadius,
            fill: this.particleFill,
        }))
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

    function getPixelPositions(imageData, sampleIncrement = 1) {
        const { width, height, data } = imageData
        let particles = []
        for (let x = 0; x < width; x += sampleIncrement) {
            for (let y = 0; y < height; y += sampleIncrement) {
                if (data[(x + y * width) * 4 + 3] > 128) {
                    particles.push({ x: x, y: y })
                }
            }
        }
        return particles
    }

    // Returns {x, y} coordinates
    function applyMoveFunction(settings, func) {
        const { to, from, completion, multiplier } = settings

        const moveFunctions = {
            linear: function () {
                return {
                    x: getTransitionNumber(from.x, to.x, completion),
                    y: getTransitionNumber(from.y, to.y, completion),
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


    function getTransitionNumber(fromNum, toNum, completion = .5) {
        let distance = toNum - fromNum
        return fromNum + distance * completion
    }

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

    function getRandomFloat(min, max) {
        return Math.random() * (max - min) + min
    }


    function getTriangle(fromXY, toXY) {
        let width = toXY.x - fromXY.x
        let height = toXY.y - fromXY.y
        let hypot = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2))
        let angle = Math.asin(height / hypot) * 180 / Math.PI
        return {
            width: width,
            height: height,
            hypot: hypot,
            angle: angle
        }
    }

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
}
