import { nanoid } from "nanoid";
import { z } from "zod";
import { getStorageJson, getStorageString, setStorageJson, setStorageString } from "./browserStorage";
import { nowMs } from "./time";

export interface LocalUser {
  id: string;
  name: string;
  createdAt: number;
}

const USERS_KEY = "invidious-local-users-v1";
const CURRENT_USER_KEY = "invidious-local-current-user-id-v1";
const localUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number().optional().default(0),
});
const localUsersSchema = z.array(localUserSchema);

const createDefaultUser = (): LocalUser => ({
  id: "local-default",
  name: "ローカルユーザー",
  createdAt: nowMs(),
});

const readUsers = (): LocalUser[] => {
  const users = getStorageJson("local", USERS_KEY, localUsersSchema, []);
  return users.length > 0 ? users : [createDefaultUser()];
};

const writeUsers = (users: LocalUser[]): void => {
  setStorageJson("local", USERS_KEY, users);
};

export const getLocalUsers = (): LocalUser[] => {
  const users = readUsers();
  writeUsers(users);
  return users;
};

export const getCurrentLocalUser = (): LocalUser => {
  const users = getLocalUsers();
  const currentUserId = getStorageString("local", CURRENT_USER_KEY);
  const current = users.find((user) => user.id === currentUserId) ?? users[0];
  setStorageString("local", CURRENT_USER_KEY, current.id);
  return current;
};

export const setCurrentLocalUser = (userId: string): LocalUser => {
  const users = getLocalUsers();
  const found = users.find((user) => user.id === userId) ?? users[0];
  setStorageString("local", CURRENT_USER_KEY, found.id);
  return found;
};

export const createLocalUser = (name: string): LocalUser => {
  const users = getLocalUsers();
  const user: LocalUser = {
    id: `local-${nanoid(10)}`,
    name: name.trim() || "ローカルユーザー",
    createdAt: nowMs(),
  };
  writeUsers([...users, user]);
  setStorageString("local", CURRENT_USER_KEY, user.id);
  return user;
};

