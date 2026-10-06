drop table if exists ad_slots;
delete from site_settings where key = 'ads_enabled';
