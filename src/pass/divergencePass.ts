import { DataTexture, EasyFireShaderContext } from "../EasyFireShaderContext";
import { dot, float, Fn, If, max, min, Return, select, vec3, vec4 } from "three/tsl";

/**
 * @returns
 */
export const divergencePass =
	(
		context: EasyFireShaderContext,
		textures: {
			velocity: DataTexture;
			divergence: DataTexture;
		},
	) =>
	() => {
		const grid = context.grid.phy;
		const coord = grid.coord;
		const uvw = grid.uvw;
		const currVel = textures.velocity.sample(uvw).xyz;
		const voxelLocalPos = uvw.sub(0.5).mul(context.uVolumeWorldSize);
		const localPos = uvw.sub(0.5).mul(context.uVolumeWorldSize);

		const speedOf = (u: number, v: number, w: number) => {
			const vel = vec3(0, 0, 0).toVar();

			context.collisions.checkCollisionAt(
				grid,
				context.uVolumeWorldSize,
				context.worldMatrix,
				voxelLocalPos,
				uvw,
				vec3(u, v, w),
				true,
				// hit
				(otherUvw, hitDistance, normal) => {
					const velDotN = dot(currVel, normal!);
					vel.assign(select(velDotN.lessThan(0), currVel.sub(normal!.mul(velDotN).mul(2)), currVel));
				},

				//miss
				(otherUvw) => vel.assign(textures.velocity.sample(otherUvw).xyz),
			);

			return vel;
		};

		const vR = speedOf(1, 0, 0).x;
		const vL = speedOf(-1, 0, 0).x;
		const vU = speedOf(0, 1, 0).y;
		const vD = speedOf(0, -1, 0).y;
		const vF = speedOf(0, 0, 1).z;
		const vB = speedOf(0, 0, -1).z;

		const voxelSize = grid.worldTexelSizeX2;

		const divergence = vR
			.sub(vL)
			.div(voxelSize.x)
			.add(vU.sub(vD).div(voxelSize.y))
			.add(vF.sub(vB).div(voxelSize.z));

		textures.divergence.write(coord, vec4(divergence, 0, 0, 0));
	};
