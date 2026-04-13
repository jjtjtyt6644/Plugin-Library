/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUniqueUsername, openUserProfile } from "@utils/discord";
import { ChannelType, RelationshipType } from "@vencord/discord-types/enums";
import { RelationshipStore, UserUtils } from "@webpack/common";

import settings from "./settings";
import { ChannelDelete, GuildDelete, RelationshipRemove } from "./types";
import { deleteGroup, deleteGuild, getGroup, getGuild, GuildAvailabilityStore, notify } from "./utils";

let manuallyRemovedFriend: string | undefined;
let manuallyRemovedGuild: string | undefined;
let manuallyRemovedGroup: string | undefined;

export const removeFriend = (id: string) => manuallyRemovedFriend = id;
export const removeGuild = (id: string) => manuallyRemovedGuild = id;
export const removeGroup = (id: string) => manuallyRemovedGroup = id;

export async function onRelationshipRemove({ relationship: { type, id } }: RelationshipRemove) {
    if (manuallyRemovedFriend === id) {
        manuallyRemovedFriend = undefined;
        return;
    }

    const user = await UserUtils.getUser(id)
        .catch(() => null);
    if (!user) return;

    switch (type) {
        case RelationshipType.FRIEND:
            if (settings.store.friends)
                notify(
                    `${getUniqueUsername(user)} has removed you as a friend (or blocked you).`,
                    user.getAvatarURL(undefined, undefined, false),
                    () => openUserProfile(user.id),
                    "#f04747" // Discord red for danger/removals
                );
            break;
        case RelationshipType.INCOMING_REQUEST:
            if (settings.store.friendRequestCancels)
                notify(
                    `A friend request from ${getUniqueUsername(user)} has been revoked.`,
                    user.getAvatarURL(undefined, undefined, false),
                    () => openUserProfile(user.id)
                );
            break;
    }
}

export function onMemberRemove({ guildId, user }: { guildId: string, user: { id: string } }) {
    if (!settings.store.mutualLeaves) return;
    if (!RelationshipStore.isFriend(user.id)) return;

    const guild = getGuild(guildId);
    if (guild) {
        notify(
            `${user.username ?? "A friend"} left the mutual server ${guild.name}.`, 
            guild.iconURL,
            undefined, 
            "#faa61a" // Discord yellow for warnings/leaves
        );
    }
}

export function onGuildDelete({ guild: { id, unavailable } }: GuildDelete) {
    if (!settings.store.servers) return;
    if (unavailable || GuildAvailabilityStore.isUnavailable(id)) return;

    if (manuallyRemovedGuild === id) {
        deleteGuild(id);
        manuallyRemovedGuild = undefined;
        return;
    }

    const guild = getGuild(id);
    if (guild) {
        deleteGuild(id);
        notify(`You were removed from the server ${guild.name}.`, guild.iconURL, undefined, "#f04747");
    }
}

export function onChannelDelete({ channel: { id, type } }: ChannelDelete) {
    if (!settings.store.groups) return;
    if (type !== ChannelType.GROUP_DM) return;

    if (manuallyRemovedGroup === id) {
        deleteGroup(id);
        manuallyRemovedGroup = undefined;
        return;
    }

    const group = getGroup(id);
    if (group) {
        deleteGroup(id);
        notify(`You were removed from the group ${group.name}.`, group.iconURL, undefined, "#f04747");
    }
}