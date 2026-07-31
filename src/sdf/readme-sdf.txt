This directory contains the Signed Distance Field (SDF) collision system, which allows the fluid simulation to interact with 3D objects in the scene.

Here is an overview of how colliders are created, managed, and used:

### CollisionHandler.ts
This is the main orchestrator class that bridges standard Three.js objects with the compute shader simulation.
- **Creation:** You attach a collider to a standard `THREE.Object3D` by calling `collisionHandler.makeObjectCollidable(obj, type)`. This assigns the object to a free data slot in the uniform arrays.
- **Updating Data:** Every frame, `CollisionHandler.update(delta)` is called. This reads the object's `worldMatrix`, position, rotation, and scale, and computes its linear and angular velocity. This data is synced to WebGPU uniform arrays so the shaders can read where the objects are and how fast they are moving.
- **Baking:** Instead of evaluating the mathematical SDF for every voxel during every physics pass, `CollisionHandler` uses a `bakeCollidersPass`. This compute pass samples the entire 3D grid, finding the closest SDF surface for each voxel. It stores the closest distance and the surface normal into `bakeTexture`, and the surface velocity into `bakeVelocityTexture`.
- **Usage:** Other fluid passes (like advection and projection) can instantly look up a voxel's proximity to a wall, the surface normal, and how fast that wall is moving by simply sampling `bakeTexture` and `bakeVelocityTexture`. This handles fluid ejection, boundary friction, and prevents fluid from penetrating solids.

### shape/SDFShape.ts
This is the abstract base class that all collision shapes must extend.
- Each shape class maintains a `uDataIndex` uniform array that points to which active object indices correspond to this specific shape type.
- Every shape must implement the `sdf(localPos, halfExtents)` method. This method executes entirely on the GPU (via TSL) and returns a scalar `float` representing the shortest distance from `localPos` to the surface of the shape. A negative distance means the point is inside the shape.

### Default Shapes
- **SDFBox (`shape/SDFBox.ts`)**: Represents a rectangular box collider. Its `sdf` method uses the half-extents (which are derived from the `Object3D`'s scale) to compute the distance to a box boundary.
- **SDFEllipsoid (`shape/SDFEllipsoid.ts`)**: Represents a sphere or ellipsoid collider. Its `sdf` method calculates the distance to an ellipsoidal surface based on non-uniform radii.

### Custom Shapes
You can create custom collision shapes by extending `SDFShape`, implementing the mathematical `sdf()` formula for your desired geometry, and passing your custom shape instances into the `CollisionHandler` constructor config array (`sdfShapes`). That happens internally in the EasyFire config object.
