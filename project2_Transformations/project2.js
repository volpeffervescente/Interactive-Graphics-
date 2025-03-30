// Returns a 3x3 transformation matrix as an array of 9 values in column-major order.
// The transformation first applies scale, then rotation, and finally translation.
// The given rotation value is in degrees.
function GetTransform( positionX, positionY, rotation, scale )
{
	//first of all, I convert degrees in radiants
	let radiants = (rotation* Math.PI)/180;
	let sinTheta = Math.sin(radiants);
	let cosTheta = Math.cos(radiants);

	//I apply scale first
	let scaleX = scale;
	let scaleY = scale;

	//Secondly, I apply rotation (on the scaled part)
	let c0r0 = cosTheta*scaleX;
	let c0r1 = sinTheta*scaleX;
	let c1r0 = -sinTheta*scaleY;
	let c1r1 = cosTheta*scaleY;

	//Lastly, I add the translation part to the matrix, which consists of another column filled with
	//positionX and positionY used to enable transformation to be executed with a matrix multiplication
	//like other transformations
	let c2r0 = positionX;
	let c2r1 = positionY;
	
	//we use the position vector, so the trick that is required for applying the traslation with a matrix multiplication
	let transfMatrix = [c0r0, c0r1, 0, c1r0, c1r1, 0, c2r0, c2r1, 1];
	return transfMatrix;
}

function helpApplyTransform(m1, m2) 
{
    let m1m2 = new Array(9);
	//I use matrix multiplication (between m1 and m2) to combine transformations
    for (let r = 0; r < 3; r++){ //loop on rows of the first matrix m1
        for (let c = 0; c < 3; c++){ //loop on columns of the second matrix m2
			//I take the current row of m1 and I multiply it by the current col of m2
            m1m2[c*3 + r] = (m1[0*3 + r] * m2[c*3 +0])+ (m1[1*3 + r] * m2[c*3 +1])+(m1[2*3 + r] * m2[c*3 +2]);
        }
    }
    return m1m2;
}

// Returns a 3x3 transformation matrix as an array of 9 values in column-major order.
// The arguments are transformation matrices in the same format.
// The returned transformation first applies trans1 and then trans2.
function ApplyTransform( trans1, trans2 )
{
	//inverted order bc I have to multiply matrices keeping in to consideration the world axes
	return helpApplyTransform(trans2, trans1);
}