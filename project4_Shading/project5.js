// This function takes the translation and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// You can use the MatrixMult function defined in project5.html to multiply two 4x4 matrices in the same format.
function GetModelViewMatrix( translationX, translationY, translationZ, rotationX, rotationY )
{
//I apply transformations in the following order: Translate → Rotate X → Rotate Y → Project

	//rotation around x axis 
	let cosX = Math.cos(rotationX);
	let sinX = Math.sin(rotationX);
	let rotationMatrixX = [1,0, 0, 0, 0, cosX, sinX, 0, 0, -sinX, cosX, 0, 0, 0, 0, 1];

	//rotation around x axis 
	let cosY = Math.cos(rotationY);
	let sinY = Math.sin(rotationY);
	let rotationMatrixY = [cosY,0, -sinY, 0, 0, 1, 0, 0, sinY, 0, cosY, 0, 0, 0, 0, 1];

	//translation 
	var trans = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		translationX, translationY, translationZ, 1
	];

	// Combine all transformations
	let modelView = MatrixMult(trans, MatrixMult(rotationMatrixX, rotationMatrixY));
	return modelView;
}


// [TO-DO] Complete the implementation of the following class.
/*
class MeshDrawer
{
	// The constructor is a good place for taking care of the necessary initializations.
	constructor()
	{
		// Create shaders

		//vertex shader is taking the input scene data and is converting everything into the canonical view volume, giving the 
		//results of the transformatins to the fragment shader (through the rasterizer process) for the actual pixel visualization 
		this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
		//the same code is running on each vertex
		//gl_position is the position of the vertex in canonical view volume coordinates
		//attributes coming from the buffer mechanism
		//uniform variables are the one shared among the vertex and the fragment shader 
		//varying var are also declared in the fragment shader bc they are the same var 

		//second parameter of shaderSource() is the src_code. In this case we directly write GL code and pass it as 
		gl.shaderSource(this.vertexShader, `
			attribute vec3 aPosition;
			attribute vec2 aTexCoord;
			attribute vec3 aNormal;  // Add the normal attribute
			uniform mat4 uModelViewProjection;
			uniform bool uSwap;
			varying vec2 vTexCoord;
			varying vec3 vNormal;  // Varying variable to pass normal to the fragment shader

			void main() {
				vec3 pos = aPosition;
				if (uSwap) {
					pos = vec3(pos.x, pos.z, pos.y);
				}

				// Pass normal to the fragment shader
				vNormal = aNormal;

				gl_Position = uModelViewProjection * vec4(pos, 1.0);
				vTexCoord = aTexCoord;
			}
		`);
		gl.compileShader(this.vertexShader);
		
		//the fragment shader, by default, is performing linear interpolation on all varying variables: all fragment whose 
		//coordinates are in-between vertexes will have interpolated color values!
		//fragm shader code is running on each fragment
		this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(this.fragmentShader, `
			precision mediump float;
			varying vec2 vTexCoord;
			varying vec3 vNormal; 
			uniform sampler2D uTexture;
			uniform bool uShowTexture;
			uniform float uShininess;

			void main() {
			    vec3 = normalize(vNormal);
				vec3 lightDir = normalize(uLightDir);
				vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));

				float diff = max(dot(normal, lightDir), 0.0);
				// Specular component (Blinn-Phong reflection model)
				vec3 halfDir = normalize(lightDir + viewDir);
				float spec = pow(max(dot(normal, halfDir), 0.0), uShininess);
				
				// Ambient light (constant)
				vec3 ambient = vec3(0.1, 0.1, 0.1);
				
				vec3 diffuseColor = vec3(1.0, 1.0, 1.0);  // Assuming white diffuse color
				vec3 specularColor = vec3(1.0, 1.0, 1.0);  // Assuming white specular color
				
				// Final color calculation
				vec3 color = ambient + diff * diffuseColor + spec * specularColor;
				
				// If texture is enabled, override the diffuse color with the texture
				if (uShowTexture) {
					color = texture2D(uTexture, vTexCoord).rgb * color;
				}
				
				gl_FragColor = vec4(color, 1.0);
			}
		`);
		gl.compileShader(this.fragmentShader);

		// Create program
		this.program = gl.createProgram();
		gl.attachShader(this.program, this.vertexShader);
		gl.attachShader(this.program, this.fragmentShader);
		gl.linkProgram(this.program);

		// Attributes and uniforms
		this.aPosition = gl.getAttribLocation(this.program, "aPosition");
		this.aTexCoord = gl.getAttribLocation(this.program, "aTexCoord");
		this.uModelViewProjection = gl.getUniformLocation(this.program, "uModelViewProjection");
		this.uSwap = gl.getUniformLocation(this.program, "uSwap");
		this.uShowTexture = gl.getUniformLocation(this.program, "uShowTexture");

		// Create buffers
		this.vertexBuffer = gl.createBuffer();
		this.texCoordBuffer = gl.createBuffer();

		// Create and configure texture
		this.texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}
	
	// This method is called every time the user opens an OBJ file.
	// The arguments of this function is an array of 3D vertex positions
	// and an array of 2D texture coordinates.
	// Every item in these arrays is a floating point value, representing one
	// coordinate of the vertex position or texture coordinate.
	// Every three consecutive elements in the vertPos array forms one vertex
	// position and every three consecutive vertex positions form a triangle.
	// Similarly, every two consecutive elements in the texCoords array
	// form the texture coordinate of a vertex.
	// Note that this method can be called multiple times.
	setMesh(vertPos, texCoords, normals)
	{
		this.numTriangles = vertPos.length / 3;

		// Position buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

		// Texture coordinates buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

		// normal buffer
		this.normalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

	}
	
	// This method is called when the user changes the state of the
	// "Swap Y-Z Axes" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	swapYZ(swap)
	{
		this.swap = swap;
	}
	
	// This method is called to draw the triangular mesh.
	// The argument is the transformation matrix, the same matrix returned
	// by the GetModelViewProjection function above.
	draw(trans, matrixMV, matrixNormal)
	{
		//Complete the WebGL initializations before drawing
		gl.useProgram(this.program);

		// Upload uniforms
		gl.uniformMatrix4fv(this.uModelViewProjection, false, trans);
		gl.uniform1i(this.uSwap, this.swap ? 1 : 0);
		gl.uniform1i(this.uShowTexture, this.showTex ? 1 : 0);

		// Position attribute
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.enableVertexAttribArray(this.aPosition);
		gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);

		// TexCoord attribute
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.enableVertexAttribArray(this.aTexCoord);
		gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);

		// Normal attribute
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.enableVertexAttribArray(this.aNormal);
		gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);

		// Bind texture
		gl.activeTexture(gl.TEXTURE0);//to specify on which texture Unit I want to send my texture 
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.uniform1i(gl.getUniformLocation(this.program, "uTexture"), 0); //associating the sampler to the texture unit
		
		//draw								
		gl.drawArrays(gl.TRIANGLES, 0, this.numTriangles);
	}
	
	// This method is called to set the texture of the mesh.
	// The argument is an HTML IMG element containing the texture data.
	setTexture(img)
	{
		gl.bindTexture(gl.TEXTURE_2D, this.texture);//Bind the texture
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); //set texture image data 
		gl.generateMipmap(gl.TEXTURE_2D);
	}
	
	// This method is called when the user changes the state of the
	// "Show Texture" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	showTexture(show)
	{
		this.showTex = show; //set the uniform parameter(s) of the fragment shader to specify if it should use the texture.
	}
	
	// This method is called to set the incoming light direction
	setLightDir( x, y, z )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify the light direction.
		// Set the light direction as a uniform
		this.uLightDir = gl.getUniformLocation(this.program, "uLightDir");
		gl.uniform3f(this.uLightDir, x, y, z);
	}
	
	// This method is called to set the shininess of the material
	setShininess( shininess )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify the shininess.
		// Set the shininess (alpha) of the material
		this.uShininess = gl.getUniformLocation(this.program, "uShininess");
		gl.uniform1f(this.uShininess, shininess);
	}
}*/


class MeshDrawer {
	constructor() {
		// Vertex shader
		const vsSource = `
			attribute vec3 aPosition;
			attribute vec2 aTexCoord;
			attribute vec3 aNormal;

			uniform mat4 uMVP;
			uniform mat4 uMV;
			uniform mat3 uNormalMatrix;

			varying vec2 vTexCoord;
			varying vec3 vNormal;
			varying vec3 vPosition;

			void main() {
				gl_Position = uMVP * vec4(aPosition, 1.0);
				vPosition = (uMV * vec4(aPosition, 1.0)).xyz;
				vNormal = normalize(uNormalMatrix * aNormal);
				vTexCoord = aTexCoord;
			}
		`;

		// Fragment shader con Blinn shading
		const fsSource = `
			precision mediump float;

			varying vec2 vTexCoord;
			varying vec3 vNormal;
			varying vec3 vPosition;

			uniform bool uShowTexture;
			uniform sampler2D uTexture;

			uniform vec3 uLightDir;
			uniform float uShininess;

			void main() {
				vec3 N = normalize(vNormal);
				vec3 L = normalize(uLightDir);
				vec3 V = normalize(-vPosition);
				vec3 H = normalize(L + V);

				float diff = max(dot(N, L), 0.0);
				//float shininess = 1.0 / (uShininess + 1.0); // Invertiamo l'effetto
				float spec = pow(max(dot(N, H), 0.0), uShininess);

				vec3 Kd = uShowTexture ? texture2D(uTexture, vTexCoord).rgb : vec3(1.0);
				vec3 Ks = vec3(1.0); // white specular

				vec3 color = Kd * diff + Ks * spec;
				gl_FragColor = vec4(color, 1.0);
			}
		`;

		this.program = InitShaderProgram(vsSource, fsSource);
		gl.useProgram(this.program);

		// Attributi
		this.aPosition = gl.getAttribLocation(this.program, "aPosition");
		this.aTexCoord = gl.getAttribLocation(this.program, "aTexCoord");
		this.aNormal = gl.getAttribLocation(this.program, "aNormal");

		// Uniform
		this.uMVP = gl.getUniformLocation(this.program, "uMVP");
		this.uMV = gl.getUniformLocation(this.program, "uMV");
		this.uNormalMatrix = gl.getUniformLocation(this.program, "uNormalMatrix");
		this.uShowTexture = gl.getUniformLocation(this.program, "uShowTexture");
		this.uLightDir = gl.getUniformLocation(this.program, "uLightDir");
		this.uShininess = gl.getUniformLocation(this.program, "uShininess");

		// Buffers
		this.positionBuffer = gl.createBuffer();
		this.texCoordBuffer = gl.createBuffer();
		this.normalBuffer = gl.createBuffer();
		this.texture = gl.createTexture();

		this.triangleCount = 0;
		this.useTexture = true;
		this.swapYZ = false;

		// Default shading params
		this.lightDir = [0, 0, 1];
		this.shininess = 50;
	}

	setMesh(vertPos, texCoords, normals) {
		if (this.swapYZ) {
			for (let i = 0; i < vertPos.length; i += 3) {
				let temp = vertPos[i + 1];
				vertPos[i + 1] = vertPos[i + 2];
				vertPos[i + 2] = temp;

				temp = normals[i + 1];
				normals[i + 1] = normals[i + 2];
				normals[i + 2] = temp;
			}
		}

		// Vertex positions
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

		// Texture coords
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

		// Normals
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

		this.triangleCount = vertPos.length / 3;
	}

	setTexture(image) {
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.generateMipmap(gl.TEXTURE_2D);
	}

	showTexture(show) {
		this.useTexture = show;
	}

	swapYZ(swap) {
		this.swapYZ = swap;
	}

	setLightDir(x, y, z) {
		this.lightDir = [x, y, z];
	}

	setShininess(shininess) {
		this.shininess = shininess;
	}

	draw(matrixMVP, matrixMV, matrixNormal) {
		gl.useProgram(this.program);

		// Uniform matrices
		gl.uniformMatrix4fv(this.uMVP, false, matrixMVP);
		gl.uniformMatrix4fv(this.uMV, false, matrixMV);
		gl.uniformMatrix3fv(this.uNormalMatrix, false, matrixNormal);

		// Light + shading
		gl.uniform3fv(this.uLightDir, this.lightDir);
		gl.uniform1f(this.uShininess, this.shininess);
		gl.uniform1i(this.uShowTexture, this.useTexture);

		// Position buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.enableVertexAttribArray(this.aPosition);
		gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);

		// TexCoord buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.enableVertexAttribArray(this.aTexCoord);
		gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);

		// Normal buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.enableVertexAttribArray(this.aNormal);
		gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);

		// Texture
		if (this.useTexture) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
		}

		gl.drawArrays(gl.TRIANGLES, 0, this.triangleCount);
	}
}
