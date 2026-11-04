export function getCommandName(canonical: string) {
    const overrideName = `COMMAND_NAME_${canonical.toUpperCase()}`;
    const override = overrideName in process.env ? process.env[overrideName] : null;
    const prefix = 'COMMAND_PREFIX' in process.env ? process.env.COMMAND_PREFIX : '';

    return `${prefix}${override && override.length > 0 ? override : canonical}`;
}
