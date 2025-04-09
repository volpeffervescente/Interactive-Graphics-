


/*
-----------------GPU Pipeline-----------------

JavaScript (CPU)
  ↓
Buffers, texture and uniform are loaded
  ↓
Vertex Shader (for each vertex)
  ↓
Interpolation between vertexes
  ↓
Fragment Shader (for each pixel of the triangle)
  ↓
Writing of the color on te screen

*/



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
			attribute vec3 aNormal;

			uniform mat4 uModelViewProjection; // Model * View * Projection
			uniform mat4 uModelView; // Model * View
			uniform mat3 uNormalMatrix;
			uniform bool uSwap;

			varying vec2 vTexCoord;
			varying vec3 vNormal; // Varying variable to pass normal to the fragment shader
			varying vec3 vPosition;

			void main() {
				vec3 pos = aPosition;
				vec3 normal = aNormal;

				if (uSwap) {
					pos = vec3(pos.x, pos.z, pos.y);
					normal = vec3(normal.x, normal.z, normal.y);
				}

				gl_Position = uModelViewProjection * vec4(pos, 1.0); //Calculates the final position of the vertex in the screen (clip space)
				vTexCoord = aTexCoord; //passing the texture coordinates to the fragment shader 
				vNormal = normalize(uNormalMatrix * normal);
				vPosition = (uModelView * vec4(pos, 1.0)).xyz; //Transforms the vertex in the camera space, useful for light control
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
			varying vec3 vPosition;

			uniform sampler2D uTexture;
			uniform bool uShowTexture;
			uniform vec3 uLightDir; //light direction
			uniform float uShininess;
		
			void main() {
				vec3 N = normalize(vNormal); //normal is interpolated and normalized    -- transforms the normal in the camera view
				vec3 L = normalize(uLightDir); //light direction is normalized in camera space
				vec3 V = normalize(-vPosition); //direction towards camera ---- camera is at (0,0,0)
				vec3 H = normalize(L + V); // halfway vector (for blinn) 

				//diffuse light component
				float diff = max(dot(N, L), 0.0); 

				//specular component
				float spec = pow(max(dot(N, H), 0.0), uShininess);

				//final color: 
				// If texture is enabled, override the diffuse color with the texture
				vec3 Kd;
				if (uShowTexture) {
					Kd = texture2D(uTexture, vTexCoord).rgb;
				} else {
					Kd = vec3(1.0, gl_FragCoord.z * gl_FragCoord.z, 0.0); //color without texture
				}

				vec3 Ks = vec3(1.0); //white specular
				vec3 color = Kd * diff + Ks * spec; // Blinn formula

				//gl_fragColor value is written inthe frameBuffer 
				//(so on the screen), in the corresponding pixel:
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
		this.aNormal = gl.getAttribLocation(this.program, "aNormal");

		this.uModelViewProjection = gl.getUniformLocation(this.program, "uModelViewProjection");
		this.uModelView = gl.getUniformLocation(this.program, "uModelView");
		this.uNormalMatrix = gl.getUniformLocation(this.program, "uNormalMatrix");
		this.uSwap = gl.getUniformLocation(this.program, "uSwap");
		this.uShowTexture = gl.getUniformLocation(this.program, "uShowTexture");
		this.uLightDir = gl.getUniformLocation(this.program, "uLightDir");
		this.uShininess = gl.getUniformLocation(this.program, "uShininess");

		// Create buffers
		this.vertexBuffer = gl.createBuffer();
		this.texCoordBuffer = gl.createBuffer();
		this.normalBuffer = gl.createBuffer(); //new buffer for normals

		// Create and configure texture
		this.texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}

    //Application Stage (CPU - JavaScript)
	// This method is called every time the user opens an OBJ file.
	// The arguments of this function is an array of 3D vertex positions
	// and an array of 2D texture coordinates.
	// and an array of 3D vertex normals.
	setMesh(vertPos, texCoords, normals)
	{
		this.numTriangles = vertPos.length / 3;

		// Position buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

		// Texture coordinates buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

		// Normals buffer
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
	// Now we receive 3 matrices: MVP, MV and Normal Matrix (for transforming normals to camera space)
	draw(matrixMVP, matrixMV, matrixNormal)
	{
		//Complete the WebGL initializations before drawing
		gl.useProgram(this.program);

		// Upload uniforms
		gl.uniformMatrix4fv(this.uModelViewProjection, false, matrixMVP);
		gl.uniformMatrix4fv(this.uModelView, false, matrixMV);
		gl.uniformMatrix3fv(this.uNormalMatrix, false, matrixNormal);
		gl.uniform1i(this.uSwap, this.swap ? 1 : 0);
		gl.uniform1i(this.uShowTexture, this.showTex ? 1 : 0);
		gl.uniform3fv(this.uLightDir, this.lightDir);
		gl.uniform1f(this.uShininess, this.shininess);

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

	// New method to set the light direction (in camera space)
	setLightDir(x, y, z)
	{
		this.lightDir = [x, y, z];
	}

	// New method to set the shininess exponent of the Blinn material model
	setShininess(shininess)
	{
		this.shininess = shininess;
	}
}
