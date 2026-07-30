import { Object3D, Quaternion } from "three";

const _parentWorldQuat = new Quaternion();

export function worldQuaternionToLocal(
	object: Object3D,
	worldQuaternion: Quaternion,
	target = new Quaternion(),
): Quaternion {
	if (!object.parent) {
		return target.copy(worldQuaternion);
	}

	object.parent.getWorldQuaternion(_parentWorldQuat);

	return target.copy(_parentWorldQuat).invert().multiply(worldQuaternion);
}
