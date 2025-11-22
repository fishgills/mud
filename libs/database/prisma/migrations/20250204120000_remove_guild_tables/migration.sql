-- Drop guild persistence; guild hall is now defined in code and no longer stored in the database.
DROP TABLE IF EXISTS "PlayerGuildState";
DROP TABLE IF EXISTS "GuildHall";
