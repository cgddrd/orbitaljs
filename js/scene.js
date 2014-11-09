function Scene(gl) {

    this.mvMatrix = mat4.create();
    this.pMatrix = mat4.create();
    this.tMatrix = mat4.create();

    this.mvMatrixStack = [];
    this.lastMatrixStack = [];

    this.gl = gl;

    this.sceneObjects = [];

    this.rootSceneObject = null;
}

Scene.prototype.setupScene = function () {

    var currentPlanet, parentPlanet;
    var parentPlanets = [];

    for (var planet in Config.scenePlanets) {

        currentPlanet = Config.scenePlanets[planet];

        this.addNewOrbital(currentPlanet.name, new Orbital(currentPlanet.name, textureCreator.getTextures(), currentPlanet.orbitVelocity, currentPlanet.spinVelocity, currentPlanet.scaleFactor, app.getBuffers(), currentPlanet.orbitRadius, currentPlanet.orbitEccentricity));

        if (currentPlanet.hasOwnProperty('children')) {
            parentPlanets.push(currentPlanet);
        }

        if (currentPlanet.hasOwnProperty('root') && currentPlanet.root === true) {
            this.rootSceneObject = this.sceneObjects[currentPlanet.name];
        }

    }

    for (var parent in parentPlanets) {

        parentPlanet = parentPlanets[parent];

        for (var child in parentPlanet.children) {

            currentPlanet = this.sceneObjects[parentPlanet.children[child]];

            this.sceneObjects[parentPlanet.name].addChildOrbital(this.sceneObjects[currentPlanet.name]);

        }
    }

    if (this.rootSceneObject === null) {
        if (this.sceneObjects.length > 0) {
            console.log("Warning: No root scene object set, using default value (0)");
            this.rootSceneObject = this.sceneObjects[0];
        } else {
            console.error("Error: No root planet chosen.");
        }

    }

}

Scene.prototype.pushMVMatrix = function () {
    this.mvMatrixStack.push(mat4.clone(this.mvMatrix));
}

Scene.prototype.popMVMatrix = function () {
    if (this.mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    this.mvMatrix = this.mvMatrixStack.pop();
}

Scene.prototype.setMatrixUniforms = function (shaderProgram) {
    this.gl.uniformMatrix4fv(shaderProgram.uPMatrix, false, this.pMatrix);
    this.gl.uniformMatrix4fv(shaderProgram.uMVMatrix, false, this.mvMatrix);
    this.gl.uniformMatrix4fv(shaderProgram.uTMatrix, false, this.tMatrix);

    var normalMatrix = mat3.create();

    mat3.normalFromMat4(normalMatrix, this.mvMatrix);

    gl.uniformMatrix3fv(shaderProgram.uNMatrix, false, normalMatrix);
}

Scene.prototype.getMVMatrix = function () {
    return this.mvMatrix;
}

Scene.prototype.getPMatrix = function () {
    return this.pMatrix;
}

Scene.prototype.getTMatrix = function () {
    return this.tMatrix;
}

Scene.prototype.getMVMatrixStack = function () {
    return this.mvMatrixStack;
}

Scene.prototype.getLastMatrixStack = function () {
    return this.lastMatrixStack;
}

Scene.prototype.setMVMatrix = function (newMVMatrix) {
    this.mvMatrix = newMVMatrix;
}

Scene.prototype.addNewOrbital = function (key, value) {
    this.sceneObjects[key] = value;
}

Scene.prototype.getRootSceneObject = function () {
    return this.rootSceneObject;
}

Scene.prototype.drawScene = function() {

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(this.getPMatrix(), 45, gl.viewportWidth / gl.viewportHeight, 0.1, 2000.0);

    // 2 * Math.PI = 360 degrees in radians.
    // We want to move the clouds of the earth along the X-axis (not the land and see however).
    // No of radians to move / 360 degrees in radians.
    mat4.translate(this.getTMatrix(), this.getTMatrix(), [Utils.degToRad(0.1) / (2 * Math.PI), 0, 0]);

    var lighting = true;

    gl.uniform1i(shaderProgram.uUseLighting, lighting);

    mat4.identity(this.getMVMatrix());

    var lightPos = [0.0, 0.0, 0.0, 1.0];

    // CG - Handle scene rotations (via mouse events)
    //mat4.multiply(mvMatrix, mvMatrix, camera.getRotationMatrix());

    // CG - Move based on the user's input.
    mat4.translate(this.getMVMatrix(), this.getMVMatrix(), [camera.getXPosition(), camera.getYPosition(), camera.getZPosition()]);

    vec4.transformMat4(lightPos, lightPos, this.getMVMatrix());

    // CG - Handle scene rotations (via mouse events)
    mat4.multiply(this.getMVMatrix(), this.getMVMatrix(), camera.getRotationMatrix());

    // CG - Handle scene zooming (via mouse wheel events)
    mat4.scale(this.getMVMatrix(), this.getMVMatrix(), [camera.getZoomFactor(), camera.getZoomFactor(), camera.getZoomFactor()]);

    this.pushMVMatrix();

    mat4.scale(this.getMVMatrix(), this.getMVMatrix(), [500, 500, 500]);

    gl.activeTexture(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_2D, textureCreator.getTextures()["spaceTexture"]);

    gl.uniform1i(shaderProgram.uSampler1, 0);
    gl.uniform1i(shaderProgram.uUseMultiTextures, false);

    gl.bindBuffer(gl.ARRAY_BUFFER, app.buffers["cubeVertexPositionBuffer"]);
    gl.vertexAttribPointer(shaderProgram.aVertexPosition, app.buffers["cubeVertexPositionBuffer"].itemSize, gl.FLOAT, false, 0, 0);

    // NEW: Set-up the cube texture buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, app.buffers["cubeVertexTextureCoordBuffer"]);
    gl.vertexAttribPointer(shaderProgram.aTextureCoord1, app.buffers["cubeVertexTextureCoordBuffer"].itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, app.buffers["cubeVertexIndexBuffer"]);

    this.setMatrixUniforms(shaderProgram);

    gl.drawElements(gl.TRIANGLES, app.buffers["cubeVertexIndexBuffer"].numItems, gl.UNSIGNED_SHORT, 0);

    this.popMVMatrix();

    //CG - Add lighting after we have rendered the skybox.
    if (lighting) {

        gl.uniform3f(
            shaderProgram.uAmbientColor,
            parseFloat(0.2),
            parseFloat(0.2),
            parseFloat(0.2)
        );

        //CG - Move the position of the point light so that it is in the centre of the sun.
        gl.uniform3f(
            shaderProgram.uPointLightingLocation,
            parseFloat(lightPos[0]),
            parseFloat(lightPos[1]),
            parseFloat(lightPos[2])
        );

        //CG - Set the point lighting colour to full (so we can see it above the ambient lighting).
        gl.uniform3f(
            shaderProgram.uPointLightingDiffuseColor,
            parseFloat(0.8),
            parseFloat(0.8),
            parseFloat(0.8)
        );

        //CG
        gl.uniform3f(
            shaderProgram.uPointLightingSpecularColor,
            parseFloat(0.2),
            parseFloat(0.2),
            parseFloat(0.2)
        );

        gl.uniform1f(shaderProgram.uMaterialShininess, parseFloat(10));
    }

    // CG - Push a new matrix for the scene.
    this.pushMVMatrix();

    // CG - Kick off the rendering (start from the Sun and work our way down the tree).
    this.getRootSceneObject().drawOrbital(camera.isSpinEnabled());

    //Pop the matrix saved from earlier in order to render out the saturn ring last.
    this.setMVMatrix(this.getLastMatrixStack().pop());

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.enable(gl.BLEND);

    mat4.rotate(this.getMVMatrix(), this.getMVMatrix(), Utils.degToRad(90), [1, 0, 0]);

    //CG - Rotate the rings around Saturn.
    mat4.rotate(this.getMVMatrix(), this.getMVMatrix(), Utils.degToRad(this.sceneObjects['saturn'].spinAngle), [0, 0, 1]);

    mat4.scale(this.getMVMatrix(), this.getMVMatrix(), [10, 10, 10]);

    gl.bindBuffer(gl.ARRAY_BUFFER, app.buffers["squareVertexPositionBuffer"]);
    gl.vertexAttribPointer(shaderProgram.aVertexPosition, app.buffers["squareVertexPositionBuffer"].itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, app.buffers["squareVertexTextureCoordBuffer"]);
    gl.vertexAttribPointer(shaderProgram.aTextureCoord1, app.buffers["squareVertexTextureCoordBuffer"].itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureCreator.getTextures()["saturnRingTexture"]);

    gl.uniform1i(shaderProgram.uSampler1, 0);

    this.setMatrixUniforms(shaderProgram);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, app.buffers["squareVertexPositionBuffer"].numItems);

    gl.disable(gl.BLEND);

    //Finally pop the top-level scene matrix.
    this.popMVMatrix();

}
