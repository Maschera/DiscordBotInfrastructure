import Discord from "discord.js";
import { DBIChatInput } from "../types/ChatInput/ChatInput";
import { REST } from "@discordjs/rest";
import { Routes, RESTGetAPIUserResult, RESTPutAPIApplicationCommandsJSONBody, ApplicationCommandType, ApplicationCommandOptionType } from "discord-api-types/v9";
import { reducePermissions } from "../utils/permissions";
import snakecaseKeys from "snakecase-keys";
import { DBI } from "../DBI";
import { DBIInteractionLocale } from "../types/InteractionLocale";

const PUBLISHABLE_TYPES = ["ChatInput", "UserContextMenu", "MessageContextMenu"];
const ORIGINAL_LOCALES = ["da", "de", "en-GB", "en-US", "es-ES", "fr", "hr", "it", "lt", "hu", "nl", "no", "pl", "pt-BR", "ro", "fi", "sv-SE", "vi", "tr", "cs", "el", "bg", "ru", "uk", "hi", "th", "zh-CN", "ja", "zh-TW", "ko"];

export async function publishInteractions(
  clientToken: string,
  interactions: Discord.Collection<string, DBIChatInput>,
  interactionsLocales: Discord.Collection<string, DBIInteractionLocale>,
  publishType: "Guild" | "Global",
  guildId?: string
) {
  interactions = interactions.filter(i => PUBLISHABLE_TYPES.includes(i.type));

  const rest = new REST({ version: "9" });
  rest.setToken(clientToken);

  const me: RESTGetAPIUserResult = await rest.get(Routes.user()) as any;
  
  let body: RESTPutAPIApplicationCommandsJSONBody =
    interactions.reduce((all, current) => {
      switch (current.type) {
        case "ChatInput": {
          let nameSplitted = current.name.split(" ");
          let localeData = formatLocale(interactionsLocales.get(current.name) ?? {} as any);
          switch (nameSplitted.length) {
            case 1: {
              all.push({
                type: ApplicationCommandType.ChatInput,
                description: current.description,
                name: nameSplitted[0],
                default_member_permissions: reducePermissions(current.defaultMemberPermissions).toString(),
                dm_permission: current.directMessages,
                options: localeifyOptions(current.options || [], localeData.optionsLocales),
                name_localizations: localeData.nameLocales(0),
                description_localizations: localeData.descriptionLocales,
              });
              break;
            }
            case 2: {
              let baseItem = all.find(i => i.name == current.name.split(" ")[0] && i.type == "ChatInput");
              let localeData = formatLocale(interactionsLocales.get(current.name) ?? {} as any);
              let option = {
                type: ApplicationCommandOptionType.Subcommand,
                name: nameSplitted[1],
                description: current.description,
                default_member_permissions: reducePermissions(current.defaultMemberPermissions).toString(),
                dm_permission: current.directMessages,
                options: localeifyOptions(current.options || [], localeData.optionsLocales),
                name_localizations: localeData.nameLocales(1),
                description_localizations: localeData.descriptionLocales,
              };
              if (!baseItem) {
                all.push({
                  type: ApplicationCommandType.ChatInput,
                  name: nameSplitted[0],
                  name_localizations: localeData.nameLocales(0),
                  description: "...",
                  options: [
                    option
                  ]
                });
              } else {
                baseItem.options.push(option);
              }
              break;
            }
            case 3: {
              let level1Item = all.find(i => i.name == current.name.split(" ")[0] && i.type == "ChatInput");
              let localeData = formatLocale(interactionsLocales.get(current.name) ?? {} as any);
              if (!level1Item) {
                all.push({
                  type: ApplicationCommandType.ChatInput,
                  name: nameSplitted[0],
                  name_localizations: localeData.nameLocales(0),
                  description: "...",
                  options: [
                    {
                      type: ApplicationCommandOptionType.SubcommandGroup,
                      name: nameSplitted[1],
                      name_localizations: localeData.nameLocales(1),
                      description: "...",
                      options: [
                        {
                          type: ApplicationCommandOptionType.Subcommand,
                          name: nameSplitted[2],
                          description: current.description,
                          default_member_permissions: reducePermissions(current.defaultMemberPermissions).toString(),
                          dm_permission: current.directMessages,
                          options: localeifyOptions(current.options || [], localeData.optionsLocales),
                          name_localizations: localeData.nameLocales(2),
                          description_localizations: localeData.descriptionLocales,
                        }
                      ]
                    }
                  ]
                });
              } else {
                let level2Item = level1Item.options.find(i => i.name == current.name.split(" ")[1] && i.type == "ChatInput");
                if (!level2Item) {
                  level1Item.options.push({
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    name: nameSplitted[1],
                    name_localizations: localeData.nameLocales(1),
                    description: "...",
                    options: [
                      {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: nameSplitted[2],
                        description: current.description,
                        default_member_permissions: reducePermissions(current.defaultMemberPermissions).toString(),
                        dm_permission: current.directMessages,
                        options: localeifyOptions(current.options || [], localeData.optionsLocales),
                        name_localizations: localeData.nameLocales(2),
                        description_localizations: localeData.descriptionLocales
                      }
                    ]
                  })
                } else {
                  level2Item.options.push({
                    type: ApplicationCommandOptionType.Subcommand,
                    name: nameSplitted[2],
                    description: current.description,
                    default_member_permissions: reducePermissions(current.defaultMemberPermissions).toString(),
                    dm_permission: current.directMessages,
                    options: localeifyOptions(current.options || [], localeData.optionsLocales),
                    name_localizations: localeData.nameLocales(2),
                    description_localizations: localeData.descriptionLocales,
                  });
                }
              }
              break;
            }
          }
          break;
        }
        case "MessageContextMenu": {
          let localeData = formatLocale(interactionsLocales.get(current.name) ?? {} as any);
          all.push({
            type: ApplicationCommandType.Message,
            name: current.name,
            default_member_permissions: reducePermissions(current.defaultMemberPermissions).toString(),
            dm_permission: current.directMessages,
            name_localizations: localeData.allNameLocales,
            description_localizations: localeData.descriptionLocales,
          });
          break;
        }
        case "UserContextMenu": {
          let localeData = formatLocale(interactionsLocales.get(current.name) ?? {} as any);
          all.push({
            type: ApplicationCommandType.User,
            name: current.name,
            default_member_permissions: reducePermissions(current.defaultMemberPermissions).toString(),
            dm_permission: current.directMessages,
            name_localizations: localeData.allNameLocales,
            description_localizations: localeData.descriptionLocales
          });
          break;
        }
      }

      return all;
    }, []);
  
  body = snakecaseKeys(body);
  
  switch (publishType) {
    case "Global": {
      await rest.put(Routes.applicationGuildCommands(me.id, guildId), { body });
      break;
    }
    case "Guild": {
      await rest.put(Routes.applicationCommands(me.id), { body });
      break;
    }
  }
  
}

export function localeifyOptions(options: any[], localeData: any): any[] {
  return options.map(i => {
    return localeData[i.name] ? Object.assign(i, {
      name_localizations: localeData[i.name].nameLocales,
      description_localizations: localeData[i.name].descriptionLocales,
    }) : i;
  })
}

export function formatLocale(locale: DBIInteractionLocale): any {
  let allNameLocales = {};
  let descriptionLocales = {};
  let optionsLocales = {};

  function nameLocales(index) {
    return Object.fromEntries(Object.entries(allNameLocales).map(i => [i[0], (i[1] as string).split(" ").at(index)]));
  }

  if (!locale?.data) return {
    nameLocales,
    allNameLocales,
    descriptionLocales,
    optionsLocales
  };

  Object.entries(locale.data).forEach(([shortLocale, localeData]) => {
    let longAliases = ORIGINAL_LOCALES.filter(i => i.split("-").at(0) == shortLocale);
    longAliases.forEach((longLocale) => {
      allNameLocales[longLocale] = localeData.name;
      descriptionLocales[longLocale] = localeData.description;
      Object.entries(localeData.options || []).forEach(([optionName, optionData]) => {
        if (!optionsLocales[optionName]) optionsLocales[optionName] = {};
        if (!optionsLocales[optionName].nameLocales) optionsLocales[optionName].nameLocales = {};
        if (!optionsLocales[optionName].descriptionLocales) optionsLocales[optionName].descriptionLocales = {};

        optionsLocales[optionName].nameLocales[longLocale] = optionData.name;
        optionsLocales[optionName].descriptionLocales[longLocale] = optionData.description;
      })
    });
  });
  
  return {
    nameLocales,
    allNameLocales,
    descriptionLocales,
    optionsLocales
  }
}