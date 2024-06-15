/**
 * @param {import("@pivotass/zvelte").Args<{ user: { active: boolean } }>} args
 */
export default function init({ props, scope }) {
    /**
     * @param {typeof props["user"]} user
     */
    scope.isActive = (user) => {
        return user.active;
    };
}
