var raytraceFS = `
struct Ray {
	vec3 pos;
	vec3 dir;
};

struct Material {
	vec3  k_d;	// diffuse coefficient
	vec3  k_s;	// specular coefficient
	float n;	// specular exponent
};

struct Sphere {
	vec3     center;
	float    radius;
	Material mtl;
};

struct Light {
	vec3 position;
	vec3 intensity;
};

struct HitInfo {
	float    t;
	vec3     position;
	vec3     normal;
	Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;
uniform int bounceLimit;

bool IntersectRay( inout HitInfo hit, Ray ray );

// Shades the given point and returns the computed color.
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
	vec3 color = vec3(0,0,0);
	for ( int i=0; i<NUM_LIGHTS; ++i ) {

		//Check for shadows
		vec3 lightDirection = normalize(lights[i].position - position);
		float delta = length(lights[i].position - position);
		Ray shadowRay;
		shadowRay.pos = position + 0.001 * lightDirection;
		shadowRay.dir = lightDirection;

		//if the shadow ray intersects an object while hitting the light source
		//and
		//if magnitude t < delta (where delta is a small positive value representing bias)
		//then the corresponding point is in shadow!
		HitInfo shadowHit;
		if(IntersectRay(shadowHit, shadowRay) && shadowHit.t < delta) continue;
		
		//If not shadowed, perform shading using the Blinn model
		float diffuseFormula = max(dot(normal, lightDirection), 0.0); //cos theta (value btwn 0 & 1)
		vec3 diffuseComponent = mtl.k_d * diffuseFormula;
		float specularFormula = pow(max(dot(normal, lightDirection), 0.0), mtl.n); //cos theta (value btwn 0 & 1), mtl.n is the alpha to which this component is elevated
		vec3 vectorH = normalize(lightDirection + view); //alternative to view vector (which represents the perfect reflection)
		vec3 specularComponent = mtl.k_s * specularFormula;

		color += (diffuseComponent + specularComponent) * lights[i].intensity;	// change this line
	}
	return color;
}

// Intersects the given ray with all spheres in the scene
// and updates the given HitInfo using the information of the sphere
// that first intersects with the ray.
// Returns true if an intersection is found.
bool IntersectRay( inout HitInfo hit, Ray ray )
{
	hit.t = 1e30;
	bool foundHit = false;
	for ( int i=0; i<NUM_SPHERES; ++i ) {
		//Test for ray-sphere intersection
		vec3 originToCenter = ray.pos - spheres[i].center;
		float a = dot(ray.dir, ray.dir);
		float b = 2.0 * dot(originToCenter, ray.dir);
		float c = dot(originToCenter, originToCenter) - (spheres[i].radius * spheres[i].radius);
		float Delta = (b*b) - (4.0*a*c); //discriminant 

		//If intersection is found, update the given HitInfo
		float t = (-b - sqrt(Delta))/(2.0 * a);
		if(t > 0.001 && t < hit.t){
			hit.t = t;
			hit.position = ray.pos + t * ray.dir; //x = position + t*direction
			hit.normal = normalize(hit.position - spheres[i].center);
			hit.mtl = spheres[i].mtl;
			foundHit = true;
		}
	}
	return foundHit;
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
	HitInfo hit;
	if ( IntersectRay( hit, ray ) ) {
		vec3 view = normalize( -ray.dir );
		vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );
		
		// Compute reflections
		vec3 k_s = hit.mtl.k_s;
		for ( int bounce=0; bounce<MAX_BOUNCES; ++bounce ) {
			if ( bounce >= bounceLimit ) break;
			if ( hit.mtl.k_s.r + hit.mtl.k_s.g + hit.mtl.k_s.b <= 0.0 ) break;
			
			Ray reflectionRay;	// this is the reflection ray
			HitInfo h;	// reflection hit info
			
			//Initialize the reflection ray
			reflectionRay.dir = reflect(-view, hit.normal); //where reflect(I, N) = I - 2.0 * dot(N, I) * N;
			reflectionRay.pos = hit.position + 0.001 * reflectionRay.dir; //pos is x = pos + bias*dir
			if ( IntersectRay( h, reflectionRay ) ) {
				//Hit found, so shade the hit point
				vec3 newView = normalize(-reflectionRay.dir);
				vec3 reflectedColor = Shade(h.mtl, h.position, h.normal, newView);

				//Update the loop variables for tracing the next reflection ray
				clr += k_s * reflectedColor;
				k_s *= h.mtl.k_s;
				hit = h;
				view = newView;

			} else {
				// The refleciton ray did not intersect with anything,
				// so we are using the environment color
				clr += k_s * textureCube( envMap, reflectionRay.dir.xzy ).rgb;
				break;	// no more reflections
			}
		}
		return vec4( clr, 1 );	// return the accumulated color, including the reflections
	} else {
		return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 0 );	// return the environment color
	}
}
`;