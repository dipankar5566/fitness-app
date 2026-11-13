CREATE TABLE  food_log_look_back (id INTEGER PRIMARY KEY AUTOINCREMENT, start_date TEXT NOT NULL, end_date  TEXT NOT NULL);

CREATE TABLE %s (%s INTEGER NOT NULL primary key, %s TEXT , %s VARCHAR(50), %s INTEGER , %s TEXT, %s TEXT, %s TEXT, %s TEXT, %s VARCHAR(20), %s TEXT, %s TEXT, %s INTEGER, %s INTEGER DEFAULT 0, %s INTEGER, %s TEXT, %s TEXT, %s TEXT, %s INTEGER, %s INTEGER DEFAULT 0, %s, %s INTEGER DEFAULT 1,%s INTEGER DEFAULT 5, %s TEXT, %s INTEGER DEFAULT 1000, %s,%s, %s, %s, %s INTEGER DEFAULT 0, %s TEXT, %s TEXT, %s INTEGER, %s TEXT, %s TEXT, %s TEXT, %s TEXT, %s TEXT);;

CREATE TABLE %s (%s INTEGER PRIMARY KEY, %s INTEGER, %s, %s, %s INTEGER, %s, %s, %s INTEGER);

CREATE TABLE `UserRatingPublishDetail` (`id` INTEGER NOT NULL, `priority` INTEGER NOT NULL, `data` TEXT  NOT NULL, `user_responded` INTEGER NOT NULL,`user_responded_timestamp` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE ce (id INTEGER PRIMARY KEY,ts BIGINT NOT NULL,ss TEXT NOT NULL);

CREATE TABLE challenges(_id INTEGER PRIMARY KEY ON CONFLICT REPLACE,name TEXT,display_name TEXT,start_date DATE,end_date DATE,is_team_challenge INTEGER DEFAULT 0,logo TEXT,logo_type TEXT,activity_types TEXT,time_windows TEXT,default_activity_type TEXT,default_time_window TEXT);

CREATE TABLE content_feeds(_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, post_id TEXT NOT NULL UNIQUE ON CONFLICT REPLACE, content_feed_id INTEGER, header TEXT, header_icon TEXT, header_icon_type TEXT, header_description TEXT, source_feed_count INTEGER, source_id INTEGER, image_url TEXT, video_url TEXT, content_url TEXT, content_header TEXT, content_type TEXT, content_summary TEXT, feed_type TEXT, posted_at TEXT, likes INTEGER DEFAULT 0, liked INTEGER DEFAULT 0, is_sponsored INTEGER DEFAULT 0, is_ad INTEGER DEFAULT 0, expiry_time TEXT, priority INTEGER DEFAULT -1, cta_text TEXT, cta_bg_color TEXT, cta_text_color TEXT, cta_action_link TEXT, comments INTEGER DEFAULT 0, shares INTEGER DEFAULT 0, feature_comment_id TEXT, featured_comment TEXT, comment_user_name TEXT, comment_user_pic TEXT, comment_user_id INTEGER DEFAULT -1, feed_metadata TEXT, is_deleted INTEGER DEFAULT 0);;

CREATE TABLE event_metadata (_id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL,FOREIGN KEY (event_id) REFERENCES events(_id) ON DELETE CASCADE);

CREATE TABLE event_payloads (sequence_num INTEGER NOT NULL, event_id INTEGER NOT NULL, bytes BLOB NOT NULL,FOREIGN KEY (event_id) REFERENCES events(_id) ON DELETE CASCADE,PRIMARY KEY (sequence_num, event_id));

CREATE TABLE events (_id INTEGER PRIMARY KEY, context_id INTEGER NOT NULL, transport_name TEXT NOT NULL, timestamp_ms INTEGER NOT NULL, uptime_ms INTEGER NOT NULL, payload BLOB NOT NULL, code INTEGER, num_attempts INTEGER NOT NULL,FOREIGN KEY (context_id) REFERENCES transport_contexts(_id) ON DELETE CASCADE);

CREATE TABLE events_points_map(_id INTEGER NOT NULL primary key AUTOINCREMENT,event_id INTEGER NOT NULL, tag TEXT NOT NULL, points INTEGER NOT NULL, feed_text TEXT NOT NULL);

CREATE TABLE fatsecret_measure_weightmaps(measure_id INTEGER NOT NULL PRIMARY KEY, food_id INTEGER NOT NULL DEFAULT 0, measure_name TEXT NOT NULL, measure_weight DOUBLE DEFAULT 0, metric_unit TEXT, calorie DOUBLE DEFAULT 0, proteins DOUBLE DEFAULT 0, fats DOUBLE DEFAULT 0, carbs DOUBLE DEFAULT 0, fibre DOUBLE DEFAULT 0, food_type INTEGER);;

CREATE TABLE feed_sources (source_id INTEGER NOT NULL UNIQUE ON CONFLICT REPLACE, name TEXT ,description TEXT, icon_type TEXT, icon_url TEXT, feed_count TEXT, extras TEXT);

CREATE TABLE foodlog(_id INTEGER NOT NULL primary key,name TEXT NOT NULL,energy double DEFAULT 0,protein double DEFAULT 0,fats double DEFAULT 0,carbs double DEFAULT 0,fibre double DEFAULT 0,sugar double DEFAULT 0,cholestrol double DEFAULT 0,saturated_fats double DEFAULT 0,sodium double DEFAULT 0,calcium double DEFAULT 0,iron double DEFAULT 0,quantitytotal integer NOT NULL,quantity double NOT NULL,measuretoweightid integer NOT NULL,mealtype VARCHAR(2) NOT NULL,food_id integer NOT NULL,health_valet_entry integer DEFAULT 0,vitamin_c double DEFAULT 0,vitamin_a double DEFAULT 0,vitamin_b6 double DEFAULT 0,folate double DEFAULT 0,zinc double DEFAULT 0,magnesium double DEFAULT 0,omega6 double DEFAULT 0,omega3 double DEFAULT 0,beta_carotene double DEFAULT 0,trans_fats double DEFAULT 0,picture_id integer default -1,install_id TEXT,server_id integer  ,isdeleted integer NOT NULL DEFAULT 0,synched integer NOT NULL DEFAULT 0,logtime INTEGER NOT NULL DEFAULT (strftime('%s','now')),timestamp INTEGER NOT NULL DEFAULT ;

CREATE TABLE foodlog_backup(;

CREATE TABLE global_log_event_state (last_metrics_upload_ms BIGINT PRIMARY KEY);

CREATE TABLE health_log(log_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, id INTEGER NOT NULL DEFAULT -1, measurement_id INTEGER NOT NULL DEFAULT -1, date TEXT NON NULL, value DOUBLE DEFAULT 0, created_at TEXT DEFAULT NULL, added_by_name TEXT DEFAULT NULL, source INTEGER NOT NULL DEFAULT 1);;

CREATE TABLE IF NOT EXISTS ;

CREATE TABLE IF NOT EXISTS %s ( %s INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, %s TEXT NOT NULL, %s TEXT, %s INTEGER, %s INTEGER, %s TEXT, %s INTEGER, %s INTEGER,%s INTEGER);;

CREATE TABLE IF NOT EXISTS %s (%s INTEGER NOT NULL primary key, %s INTEGER, %s INTEGER, %s INTEGER DEFAULT 0,%s TEXT,%s DATETIME NOT NULL DEFAULT %s ,%s, %s,%s TEXT DEFAULT '', %s TEXT DEFAULT '', %s TEXT DEFAULT '', %s TEXT DEFAULT '', %s TEXT DEFAULT '', %s INTEGER DEFAULT 0, %s INTEGER DEFAULT 0, %s INTEGER DEFAULT 0, %s INTEGER DEFAULT 0, %s TEXT, %s INTEGER DEFAULT 0, %s INTEGER DEFAULT 0, %s INTEGER DEFAULT 0, %s TEXT DEFAULT '');;

CREATE TABLE IF NOT EXISTS `_new_SystemIdInfo` (
            `work_spec_id` TEXT NOT NULL, 
            `generation` INTEGER NOT NULL DEFAULT 0, 
            `system_id` INTEGER NOT NULL, 
            PRIMARY KEY(`work_spec_id`, `generation`), 
            FOREIGN KEY(`work_spec_id`) REFERENCES `WorkSpec`(`id`) 
                ON UPDATE CASCADE ON DELETE CASCADE );

CREATE TABLE IF NOT EXISTS `_new_WorkSpec` (
                `id` TEXT NOT NULL,
                `state` INTEGER NOT NULL,
                `worker_class_name` TEXT NOT NULL,
                `input_merger_class_name` TEXT NOT NULL,
                `input` BLOB NOT NULL,
                `output` BLOB NOT NULL,
                `initial_delay` INTEGER NOT NULL,
                `interval_duration` INTEGER NOT NULL,
                `flex_duration` INTEGER NOT NULL,
                `run_attempt_count` INTEGER NOT NULL,
                `backoff_policy` INTEGER NOT NULL,
                `backoff_delay_duration` INTEGER NOT NULL,
                `last_enqueue_time` INTEGER NOT NULL,
                `minimum_retention_duration` INTEGER NOT NULL,
                `schedule_requested_at` INTEGER NOT NULL,
                `run_in_foreground` INTEGER NOT NULL,
                `out_of_quota_policy` INTEGER NOT NULL,
                `period_count` INTEGER NOT NULL DEFAULT 0,
                `generation` INTEGER NOT NULL DEFAULT 0,
                `required_network_type` INTEGER NOT NULL,
                `requires_charging` INTEGER NOT NULL,
                `requires_device_idle` INTEGER NOT NULL,
                `requires_battery_not_low` INTEGER NOT NULL,
                `requires_storage_not_low` INTEGER NOT NULL,
                `trigger_content_update_delay` INTEGER NOT NULL,
                `trigger_max_content_delay` INTEGER NOT NULL,
                `content_uri_triggers` BLOB NOT NULL,
                PRIMARY KEY(`id`)
                );

CREATE TABLE IF NOT EXISTS `_new_WorkSpec` (`id` TEXT NOT NULL, `state` INTEGER NOT NULL, `worker_class_name` TEXT NOT NULL, `input_merger_class_name` TEXT NOT NULL, `input` BLOB NOT NULL, `output` BLOB NOT NULL, `initial_delay` INTEGER NOT NULL, `interval_duration` INTEGER NOT NULL, `flex_duration` INTEGER NOT NULL, `run_attempt_count` INTEGER NOT NULL, `backoff_policy` INTEGER NOT NULL, `backoff_delay_duration` INTEGER NOT NULL, `last_enqueue_time` INTEGER NOT NULL DEFAULT -1, `minimum_retention_duration` INTEGER NOT NULL, `schedule_requested_at` INTEGER NOT NULL, `run_in_foreground` INTEGER NOT NULL, `out_of_quota_policy` INTEGER NOT NULL, `period_count` INTEGER NOT NULL DEFAULT 0, `generation` INTEGER NOT NULL DEFAULT 0, `next_schedule_time_override` INTEGER NOT NULL DEFAULT 9223372036854775807, `next_schedule_time_override_generation` INTEGER NOT NULL DEFAULT 0, `stop_reason` INTEGER NOT NULL DEFAULT -256, `required_network_type` INTEGER NOT NULL, `requires_charging` INTEGER NOT NULL, `requires_device_idle` INTEGER NOT NULL, `requires_battery_not_low` INTEGER NOT NULL, `requires_storage_not_low` INTEGER NOT NULL, `trigger_content_update_delay` INTEGER NOT NULL, `trigger_max_content_delay` INTEGER NOT NULL, `content_uri_triggers` BLOB NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `_new_WorkSpec` (`id` TEXT NOT NULL, `state` INTEGER NOT NULL, `worker_class_name` TEXT NOT NULL, `input_merger_class_name` TEXT NOT NULL, `input` BLOB NOT NULL, `output` BLOB NOT NULL, `initial_delay` INTEGER NOT NULL, `interval_duration` INTEGER NOT NULL, `flex_duration` INTEGER NOT NULL, `run_attempt_count` INTEGER NOT NULL, `backoff_policy` INTEGER NOT NULL, `backoff_delay_duration` INTEGER NOT NULL, `last_enqueue_time` INTEGER NOT NULL, `minimum_retention_duration` INTEGER NOT NULL, `schedule_requested_at` INTEGER NOT NULL, `run_in_foreground` INTEGER NOT NULL, `out_of_quota_policy` INTEGER NOT NULL, `period_count` INTEGER NOT NULL DEFAULT 0, `generation` INTEGER NOT NULL DEFAULT 0, `required_network_type` INTEGER NOT NULL, `requires_charging` INTEGER NOT NULL, `requires_device_idle` INTEGER NOT NULL, `requires_battery_not_low` INTEGER NOT NULL, `requires_storage_not_low` INTEGER NOT NULL, `trigger_content_update_delay` INTEGER NOT NULL, `trigger_max_content_delay` INTEGER NOT NULL, `content_uri_triggers` BLOB NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `_new_WorkSpec` (`id` TEXT NOT NULL, `state` INTEGER NOT NULL, `worker_class_name` TEXT NOT NULL, `input_merger_class_name` TEXT, `input` BLOB NOT NULL, `output` BLOB NOT NULL, `initial_delay` INTEGER NOT NULL, `interval_duration` INTEGER NOT NULL, `flex_duration` INTEGER NOT NULL, `run_attempt_count` INTEGER NOT NULL, `backoff_policy` INTEGER NOT NULL, `backoff_delay_duration` INTEGER NOT NULL, `last_enqueue_time` INTEGER NOT NULL, `minimum_retention_duration` INTEGER NOT NULL, `schedule_requested_at` INTEGER NOT NULL, `run_in_foreground` INTEGER NOT NULL, `out_of_quota_policy` INTEGER NOT NULL, `period_count` INTEGER NOT NULL DEFAULT 0, `required_network_type` INTEGER NOT NULL, `requires_charging` INTEGER NOT NULL, `requires_device_idle` INTEGER NOT NULL, `requires_battery_not_low` INTEGER NOT NULL, `requires_storage_not_low` INTEGER NOT NULL, `trigger_content_update_delay` INTEGER NOT NULL, `trigger_max_content_delay` INTEGER NOT NULL, `content_uri_triggers` BLOB NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `_new_WorkSpec` (`id` TEXT NOT NULL, `state` INTEGER NOT NULL, `worker_class_name` TEXT NOT NULL, `input_merger_class_name` TEXT, `input` BLOB NOT NULL, `output` BLOB NOT NULL, `initial_delay` INTEGER NOT NULL, `interval_duration` INTEGER NOT NULL, `flex_duration` INTEGER NOT NULL, `run_attempt_count` INTEGER NOT NULL, `backoff_policy` INTEGER NOT NULL, `backoff_delay_duration` INTEGER NOT NULL, `period_start_time` INTEGER NOT NULL, `minimum_retention_duration` INTEGER NOT NULL, `schedule_requested_at` INTEGER NOT NULL, `run_in_foreground` INTEGER NOT NULL, `out_of_quota_policy` INTEGER NOT NULL, `required_network_type` INTEGER NOT NULL, `requires_charging` INTEGER NOT NULL, `requires_device_idle` INTEGER NOT NULL, `requires_battery_not_low` INTEGER NOT NULL, `requires_storage_not_low` INTEGER NOT NULL, `trigger_content_update_delay` INTEGER NOT NULL, `trigger_max_content_delay` INTEGER NOT NULL, `content_uri_triggers` BLOB NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `aggregated_exercise` (`uid` TEXT NOT NULL, `server_id` TEXT, `start_time` INTEGER NOT NULL, `end_time` INTEGER NOT NULL, `steps` REAL, `distance` REAL, `total_calories` REAL, `active_calories` REAL, `bmr_calories` REAL, `platform_source` INTEGER NOT NULL, `source` INTEGER NOT NULL, `is_synced` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, PRIMARY KEY(`uid`, `platform_source`, `source`));

CREATE TABLE IF NOT EXISTS `Analytics` (`id` INTEGER NOT NULL, `data` TEXT, `type` TEXT, `synced` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `app_launch` (`launch_ts` INTEGER NOT NULL, `app_version` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `pre_auth_key` TEXT, `id` TEXT NOT NULL, `is_synced` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `app_session` (`session_id` TEXT NOT NULL, `session_start` INTEGER NOT NULL, `session_end` INTEGER NOT NULL, `session_time` INTEGER NOT NULL, `session_minimize` INTEGER NOT NULL, `is_synced` INTEGER NOT NULL, `pre_auth_key` TEXT, `user_id` INTEGER NOT NULL, `app_session_ended` INTEGER NOT NULL, PRIMARY KEY(`session_id`));

CREATE TABLE IF NOT EXISTS `assistant` (`local_id` TEXT NOT NULL, `server_id` INTEGER, `text` TEXT NOT NULL, `from_user` INTEGER NOT NULL, `time_stamp` INTEGER NOT NULL, `extras` TEXT, `speech` TEXT, `rating` INTEGER NOT NULL, `should_show_rating` INTEGER NOT NULL, `message_reply_for` TEXT, `action_result` INTEGER, `message_type` TEXT, PRIMARY KEY(`local_id`));

CREATE TABLE IF NOT EXISTS `attachment_inner_entity` (`id` TEXT NOT NULL, `messageId` TEXT NOT NULL, `authorName` TEXT, `titleLink` TEXT, `authorLink` TEXT, `thumbUrl` TEXT, `imageUrl` TEXT, `assetUrl` TEXT, `ogUrl` TEXT, `mimeType` TEXT, `fileSize` INTEGER NOT NULL, `title` TEXT, `text` TEXT, `type` TEXT, `image` TEXT, `name` TEXT, `fallback` TEXT, `uploadFilePath` TEXT, `originalHeight` INTEGER, `originalWidth` INTEGER, `extraData` TEXT NOT NULL, `statusCode` INTEGER, `errorMessage` TEXT, PRIMARY KEY(`id`), FOREIGN KEY(`messageId`) REFERENCES `stream_chat_message`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE IF NOT EXISTS `cgm_offset` (`created_at` INTEGER NOT NULL, `offset_value` INTEGER NOT NULL, `sensor_device_id` TEXT NOT NULL, PRIMARY KEY(`created_at`));

CREATE TABLE IF NOT EXISTS `command_inner_entity` (`name` TEXT NOT NULL, `description` TEXT NOT NULL, `args` TEXT NOT NULL, `set` TEXT NOT NULL, `channelType` TEXT NOT NULL, `id` INTEGER NOT NULL, PRIMARY KEY(`id`), FOREIGN KEY(`channelType`) REFERENCES `stream_chat_channel_config`(`channelType`) ON UPDATE CASCADE ON DELETE CASCADE );

CREATE TABLE IF NOT EXISTS `Dependency` (`work_spec_id` TEXT NOT NULL, `prerequisite_id` TEXT NOT NULL, PRIMARY KEY(`work_spec_id`, `prerequisite_id`), FOREIGN KEY(`work_spec_id`) REFERENCES `WorkSpec`(`id`) ON UPDATE CASCADE ON DELETE CASCADE , FOREIGN KEY(`prerequisite_id`) REFERENCES `WorkSpec`(`id`) ON UPDATE CASCADE ON DELETE CASCADE );

CREATE TABLE IF NOT EXISTS `exercises` (`uid` TEXT NOT NULL, `server_id` TEXT, `title` TEXT, `exercise_name` TEXT, `start_time` INTEGER NOT NULL, `end_time` INTEGER NOT NULL, `exercise_type` INTEGER NOT NULL, `exercise_hme_type` INTEGER, `steps` INTEGER, `distance` REAL, `total_calories` REAL, `active_calories` REAL, `bmr_calories` REAL, `metadata_id` TEXT, `client_record_id` TEXT, `client_record_version` TEXT, `data_origin` TEXT, `last_modified_time` TEXT, `recording_method` TEXT, `platform_source` INTEGER NOT NULL, `source` INTEGER NOT NULL, `is_synced` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, PRIMARY KEY(`uid`, `platform_source`, `source`));

CREATE TABLE IF NOT EXISTS `glucose_data` (`id` TEXT NOT NULL, `sensor_id` TEXT, `sensor_type` TEXT, `sensor_start_date` INTEGER NOT NULL, `type` TEXT, `age_in_sensor_minutes` INTEGER NOT NULL, `glucose_level_raw` INTEGER NOT NULL, `calibrated_glucose` INTEGER NOT NULL, `raw_glucose` INTEGER NOT NULL, `date` INTEGER NOT NULL, `timezone_offset_minutes` INTEGER NOT NULL, `is_synced` INTEGER NOT NULL, `metadata_id` TEXT, `client_record_id` TEXT, `client_record_version` TEXT, `data_origin` TEXT, `last_modified_time` TEXT, `recording_method` TEXT, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `HeartRateRecords` (`time` INTEGER NOT NULL, `beats_per_minute` INTEGER NOT NULL, `id` TEXT NOT NULL, `metadata_id` TEXT NOT NULL, `client_record_id` TEXT, `client_record_version` INTEGER NOT NULL, `data_origin` TEXT, `last_modified_time` INTEGER NOT NULL, `recording_method` INTEGER NOT NULL, `platform_source` TEXT NOT NULL, `is_synced` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `logs` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `is_synced` INTEGER NOT NULL, `local_id` TEXT, `device_id` TEXT, `server_id` INTEGER, `medicine_id` INTEGER NOT NULL, `unit_id` INTEGER NOT NULL, `quantity` REAL NOT NULL, `prescription_time` INTEGER NOT NULL, `local_log_time` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS `ManagedEventData` (`id` TEXT NOT NULL, `createdAt` INTEGER NOT NULL, `name` TEXT NOT NULL, `parameters` TEXT NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `ManagedTriggerRuleOccurrence` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `createdAt` INTEGER NOT NULL, `occurrenceKey` TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS `medicine_v2_cache` (`id` INTEGER NOT NULL, `name` TEXT NOT NULL, `unitId` INTEGER NOT NULL, `unitName` TEXT NOT NULL, `unitImageUrl` TEXT, `doseStrength` TEXT, `unitsPerIntake` REAL NOT NULL, `numOfDoses` INTEGER NOT NULL, `frequencyType` TEXT NOT NULL, `frequencyJson` TEXT NOT NULL, `startDate` TEXT, `endDate` TEXT, `isDeleted` INTEGER NOT NULL, `createdAt` TEXT, `updatedAt` TEXT, `syncStatus` TEXT NOT NULL, `isReminderOn` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `medicine_v2_dose_log_cache` (`localId` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `medicineId` INTEGER NOT NULL, `doseNumber` INTEGER NOT NULL, `prescriptionDate` TEXT NOT NULL, `timeTaken` TEXT, `status` TEXT NOT NULL, `doseStrength` TEXT, `syncStatus` TEXT NOT NULL, `remoteLogId` INTEGER);

CREATE TABLE IF NOT EXISTS `medicine_v2_pending_symptom_cache` (`entryId` INTEGER NOT NULL, `symptomId` INTEGER, `name` TEXT NOT NULL, `intensityLevel` TEXT NOT NULL, `intensityScaleValue` INTEGER NOT NULL, `additionalInfo` TEXT, `loggedAtMillis` INTEGER NOT NULL, PRIMARY KEY(`entryId`));

CREATE TABLE IF NOT EXISTS `medicine_v2_unit_cache` (`id` INTEGER NOT NULL, `name` TEXT NOT NULL, `imageUrl` TEXT, `isDeleted` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `medicines` (`id` INTEGER NOT NULL, `name` TEXT NOT NULL, `default_unit_id` INTEGER NOT NULL, `is_verified` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, `schedule_id` INTEGER, `schedule_start_date` INTEGER, `schedule_end_date` INTEGER, `frequency_type` TEXT, `frequency` TEXT, `is_reminder_on` INTEGER NOT NULL, `dose_strength` TEXT, `quantity` REAL, `info_identifier` TEXT, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `message_receipt` (`messageId` TEXT NOT NULL, `cid` TEXT NOT NULL, `createdAt` INTEGER NOT NULL, PRIMARY KEY(`messageId`));

CREATE TABLE IF NOT EXISTS `my_meals` (`foods` TEXT NOT NULL, `name` TEXT NOT NULL, `image_url` TEXT, `meal_type` TEXT, `is_deleted` INTEGER NOT NULL, `meal_id` INTEGER NOT NULL, PRIMARY KEY(`meal_id`));

CREATE TABLE IF NOT EXISTS `Preference` (`key` TEXT NOT NULL, `long_value` INTEGER, PRIMARY KEY(`key`));

CREATE TABLE IF NOT EXISTS `reply_attachment_inner_entity` (`id` TEXT NOT NULL, `messageId` TEXT NOT NULL, `authorName` TEXT, `titleLink` TEXT, `authorLink` TEXT, `thumbUrl` TEXT, `imageUrl` TEXT, `assetUrl` TEXT, `ogUrl` TEXT, `mimeType` TEXT, `fileSize` INTEGER NOT NULL, `title` TEXT, `text` TEXT, `type` TEXT, `image` TEXT, `name` TEXT, `fallback` TEXT, `uploadFilePath` TEXT, `originalHeight` INTEGER, `originalWidth` INTEGER, `extraData` TEXT NOT NULL, `statusCode` INTEGER, `errorMessage` TEXT, PRIMARY KEY(`id`), FOREIGN KEY(`messageId`) REFERENCES `stream_chat_reply_message`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE IF NOT EXISTS `respiratory_rate` (`rate` REAL NOT NULL, `time` INTEGER NOT NULL, `id` TEXT NOT NULL, `metadata_id` TEXT NOT NULL, `client_record_id` TEXT, `client_record_version` INTEGER NOT NULL, `data_origin` TEXT, `last_modified_time` INTEGER NOT NULL, `recording_method` INTEGER NOT NULL, `platform_source` TEXT NOT NULL, `is_synced` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `resting_heart_rate` (`time` INTEGER NOT NULL, `beats_per_minute` INTEGER NOT NULL, `id` TEXT NOT NULL, `metadata_id` TEXT NOT NULL, `client_record_id` TEXT, `client_record_version` INTEGER NOT NULL, `data_origin` TEXT, `last_modified_time` INTEGER NOT NULL, `recording_method` INTEGER NOT NULL, `platform_source` TEXT NOT NULL, `is_synced` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `sensor_raw_data` (`sync_timestamp` INTEGER NOT NULL, `raw_data` BLOB NOT NULL, `sensor_id` TEXT NOT NULL, `is_synced` INTEGER NOT NULL, PRIMARY KEY(`sync_timestamp`));

CREATE TABLE IF NOT EXISTS `sensor_raw_data` (`sync_timestamp` INTEGER NOT NULL, `raw_data` BLOB NOT NULL, `sensor_id` TEXT NOT NULL, `sensor_model` INTEGER NOT NULL, `patch_info` BLOB NOT NULL, `last_sync_age` INTEGER NOT NULL, `is_synced` INTEGER NOT NULL, PRIMARY KEY(`sync_timestamp`));

CREATE TABLE IF NOT EXISTS `sleep_tracker` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `is_synced` INTEGER NOT NULL, `metadata_id` TEXT, `client_record_id` TEXT, `client_record_version` INTEGER, `data_origin` TEXT, `last_modified_time` INTEGER, `recording_method` INTEGER, `server_id` TEXT, `is_deleted` INTEGER NOT NULL, `start_time` INTEGER, `end_time` INTEGER, `local_id` TEXT, `entry_time` INTEGER, `source` INTEGER NOT NULL, `source_log_id` TEXT, `device_id` TEXT, `stage_type` INTEGER);

CREATE TABLE IF NOT EXISTS `SnapDetectedImage` (`timestamp` INTEGER NOT NULL, `file_name` TEXT NOT NULL, `file_path` TEXT NOT NULL, `file_lat_lng` TEXT, `is_synced` INTEGER NOT NULL, `server_image_id` INTEGER NOT NULL, `uuid` TEXT, `confidence` REAL NOT NULL DEFAULT -1.0, `threshold_confidence` REAL NOT NULL DEFAULT -1.0, `ml_model_version` INTEGER NOT NULL DEFAULT 0, `is_uploading` INTEGER NOT NULL DEFAULT false, `uploading_timestamp` INTEGER NOT NULL DEFAULT -1, `ocr_enabled` INTEGER NOT NULL DEFAULT false, `ocr_threshold` INTEGER NOT NULL DEFAULT -1, `ocr_recognised_text` TEXT, `ocr_recognition_crashed` INTEGER NOT NULL DEFAULT false, `session_id` TEXT, `is_look_back` INTEGER NOT NULL DEFAULT false, `upload_retry` INTEGER NOT NULL DEFAULT false, `upload_status` INTEGER, `image_hash` TEXT NOT NULL DEFAULT '', `capture_origin` TEXT, `is_raw_upload_file` INTEGER NOT NULL DEFAULT false, PRIMARY KEY(`timestamp`));

CREATE TABLE IF NOT EXISTS `SnapNoFood` (`timestamp` INTEGER NOT NULL, `file_name` TEXT NOT NULL, `file_path` TEXT NOT NULL, `confidence` REAL NOT NULL DEFAULT -1.0, `threshold_confidence` REAL NOT NULL DEFAULT -1.0, `ml_model_version` INTEGER NOT NULL DEFAULT 0, `ocr_enabled` INTEGER NOT NULL DEFAULT false, `ocr_threshold` INTEGER NOT NULL DEFAULT -1, `ocr_recognised_text` TEXT, `ocr_recognition_crashed` INTEGER NOT NULL DEFAULT false, `session_id` TEXT, `is_look_back` INTEGER NOT NULL DEFAULT false, PRIMARY KEY(`timestamp`));

CREATE TABLE IF NOT EXISTS `steps_aggregated_data` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `server_id` TEXT NOT NULL, `timestamp` INTEGER NOT NULL, `steps_value` INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS `steps_data` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `device_id` TEXT NOT NULL, `install_id` TEXT NOT NULL, `start_ts` INTEGER NOT NULL, `end_ts` INTEGER NOT NULL, `steps_value` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, `is_synced` INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS `stream_channel_query` (`id` TEXT NOT NULL, `filter` TEXT NOT NULL, `querySort` TEXT NOT NULL, `cids` TEXT NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `stream_chat_channel_config` (`channelType` TEXT NOT NULL, `createdAt` INTEGER, `updatedAt` INTEGER, `name` TEXT NOT NULL, `isTypingEvents` INTEGER NOT NULL, `isReadEvents` INTEGER NOT NULL, `deliveryEventsEnabled` INTEGER NOT NULL, `isConnectEvents` INTEGER NOT NULL, `isSearch` INTEGER NOT NULL, `isReactionsEnabled` INTEGER NOT NULL, `isThreadEnabled` INTEGER NOT NULL, `isMutes` INTEGER NOT NULL, `uploadsEnabled` INTEGER NOT NULL, `urlEnrichmentEnabled` INTEGER NOT NULL, `customEventsEnabled` INTEGER NOT NULL, `pushNotificationsEnabled` INTEGER NOT NULL, `messageRetention` TEXT NOT NULL, `maxMessageLength` INTEGER NOT NULL, `automod` TEXT NOT NULL, `automodBehavior` TEXT NOT NULL, `blocklistBehavior` TEXT NOT NULL, `messageRemindersEnabled` INTEGER NOT NULL, `markMessagesPending` INTEGER NOT NULL, PRIMARY KEY(`channelType`));

CREATE TABLE IF NOT EXISTS `stream_chat_channel_state` (`type` TEXT NOT NULL, `channelId` TEXT NOT NULL, `name` TEXT NOT NULL, `image` TEXT NOT NULL, `cooldown` INTEGER NOT NULL, `createdByUserId` TEXT NOT NULL, `filterTags` TEXT NOT NULL, `frozen` INTEGER NOT NULL, `hidden` INTEGER, `hideMessagesBefore` INTEGER, `members` TEXT NOT NULL, `memberCount` INTEGER NOT NULL, `watcherIds` TEXT NOT NULL, `watcherCount` INTEGER NOT NULL, `reads` TEXT NOT NULL, `lastMessageAt` INTEGER, `lastMessageId` TEXT, `createdAt` INTEGER, `updatedAt` INTEGER, `deletedAt` INTEGER, `extraData` TEXT NOT NULL, `syncStatus` INTEGER NOT NULL, `team` TEXT NOT NULL, `ownCapabilities` TEXT NOT NULL, `membership` TEXT, `activeLiveLocations` TEXT NOT NULL, `messageCount` INTEGER, `cid` TEXT NOT NULL, PRIMARY KEY(`cid`));

CREATE TABLE IF NOT EXISTS `stream_chat_draft_message_entity` (`id` TEXT NOT NULL, `cid` TEXT NOT NULL, `text` TEXT NOT NULL, `parentId` TEXT, `mentionedUsersIds` TEXT NOT NULL, `silent` INTEGER NOT NULL, `showInChannel` INTEGER NOT NULL, `replyMessageId` TEXT, `extraData` TEXT NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `stream_chat_message` (`id` TEXT NOT NULL, `cid` TEXT NOT NULL, `userId` TEXT NOT NULL, `text` TEXT NOT NULL, `html` TEXT NOT NULL, `type` TEXT NOT NULL, `syncStatus` INTEGER NOT NULL, `replyCount` INTEGER NOT NULL, `deletedReplyCount` INTEGER NOT NULL, `createdAt` INTEGER, `createdLocallyAt` INTEGER, `updatedAt` INTEGER, `updatedLocallyAt` INTEGER, `deletedAt` INTEGER, `remoteMentionedUserIds` TEXT NOT NULL, `mentionedUsersId` TEXT NOT NULL, `reactionCounts` TEXT NOT NULL, `reactionScores` TEXT NOT NULL, `reactionGroups` TEXT NOT NULL, `parentId` TEXT, `command` TEXT, `shadowed` INTEGER NOT NULL, `i18n` TEXT NOT NULL, `showInChannel` INTEGER NOT NULL, `silent` INTEGER NOT NULL, `extraData` TEXT NOT NULL, `replyToId` TEXT, `pinned` INTEGER NOT NULL, `pinnedAt` INTEGER, `pinExpires` INTEGER, `pinnedByUserId` TEXT, `threadParticipantsIds` TEXT NOT NULL, `skipPushNotification` INTEGER NOT NULL, `skipEnrichUrl` INTEGER NOT NULL, `moderationDetails` TEXT, `moderation` TEXT, `messageTextUpdatedAt` INTEGER, `pollId` TEXT, `restrictedVisibility` TEXT NOT NULL, `reminder` TEXT, `sharedLocation` TEXT, `channelRole` TEXT, `deletedForMe` INTEGER NOT NULL, `channel_infocid` TEXT, `channel_infoid` TEXT, `channel_infotype` TEXT, `channel_infomemberCount` INTEGER, `channel_infoname` TEXT, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `stream_chat_poll` (`id` TEXT NOT NULL, `name` TEXT NOT NULL, `description` TEXT NOT NULL, `options` TEXT NOT NULL, `votingVisibility` TEXT NOT NULL, `enforceUniqueVote` INTEGER NOT NULL, `maxVotesAllowed` INTEGER NOT NULL, `allowUserSuggestedOptions` INTEGER NOT NULL, `allowAnswers` INTEGER NOT NULL, `voteCount` INTEGER NOT NULL, `voteCountsByOption` TEXT NOT NULL, `votes` TEXT NOT NULL, `ownVotes` TEXT NOT NULL, `createdAt` INTEGER NOT NULL, `updatedAt` INTEGER NOT NULL, `closed` INTEGER NOT NULL, `answersCount` INTEGER NOT NULL, `answers` TEXT NOT NULL, `createdById` TEXT, `extraData` TEXT NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `stream_chat_reaction` (`messageId` TEXT NOT NULL, `userId` TEXT NOT NULL, `type` TEXT NOT NULL, `score` INTEGER NOT NULL, `createdAt` INTEGER, `createdLocallyAt` INTEGER, `updatedAt` INTEGER, `deletedAt` INTEGER, `enforceUnique` INTEGER NOT NULL, `skipPush` INTEGER NOT NULL, `emojiCode` TEXT, `extraData` TEXT NOT NULL, `syncStatus` INTEGER NOT NULL, `id` INTEGER NOT NULL, PRIMARY KEY(`id`), FOREIGN KEY(`messageId`) REFERENCES `stream_chat_message`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE IF NOT EXISTS `stream_chat_reply_message` (`id` TEXT NOT NULL, `cid` TEXT NOT NULL, `userId` TEXT NOT NULL, `text` TEXT NOT NULL, `html` TEXT NOT NULL, `type` TEXT NOT NULL, `syncStatus` INTEGER NOT NULL, `replyCount` INTEGER NOT NULL, `deletedReplyCount` INTEGER NOT NULL, `createdAt` INTEGER, `createdLocallyAt` INTEGER, `updatedAt` INTEGER, `updatedLocallyAt` INTEGER, `deletedAt` INTEGER, `remoteMentionedUserIds` TEXT NOT NULL, `mentionedUsersId` TEXT NOT NULL, `parentId` TEXT, `command` TEXT, `shadowed` INTEGER NOT NULL, `i18n` TEXT NOT NULL, `showInChannel` INTEGER NOT NULL, `silent` INTEGER NOT NULL, `extraData` TEXT NOT NULL, `pinned` INTEGER NOT NULL, `pinnedAt` INTEGER, `pinExpires` INTEGER, `pinnedByUserId` TEXT, `threadParticipantsIds` TEXT NOT NULL, `moderationDetails` TEXT, `messageTextUpdatedAt` INTEGER, `pollId` TEXT, `restrictedVisibility` TEXT NOT NULL, `reminder` TEXT, `channelRole` TEXT, `channel_infocid` TEXT, `channel_infoid` TEXT, `channel_infotype` TEXT, `channel_infomemberCount` INTEGER, `channel_infoname` TEXT, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `stream_chat_thread_order` (`id` TEXT NOT NULL, `order` TEXT NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `stream_chat_thread` (`parentMessageId` TEXT NOT NULL, `cid` TEXT NOT NULL, `createdByUserId` TEXT NOT NULL, `activeParticipantCount` INTEGER NOT NULL, `participantCount` INTEGER NOT NULL, `threadParticipantIds` TEXT NOT NULL, `lastMessageAt` INTEGER NOT NULL, `createdAt` INTEGER NOT NULL, `updatedAt` INTEGER NOT NULL, `deletedAt` INTEGER, `title` TEXT NOT NULL, `read` TEXT NOT NULL, `latestReplyIds` TEXT NOT NULL, `extraData` TEXT NOT NULL, PRIMARY KEY(`parentMessageId`));

CREATE TABLE IF NOT EXISTS `stream_chat_user` (`id` TEXT NOT NULL, `originalId` TEXT NOT NULL, `name` TEXT NOT NULL, `image` TEXT NOT NULL, `role` TEXT NOT NULL, `createdAt` INTEGER, `updatedAt` INTEGER, `lastActive` INTEGER, `invisible` INTEGER NOT NULL, `privacySettings` TEXT, `banned` INTEGER NOT NULL, `mutes` TEXT NOT NULL, `teams` TEXT NOT NULL, `teamsRole` TEXT NOT NULL, `extraData` TEXT NOT NULL, `avgResponseTime` INTEGER, `pushPreference` TEXT, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `stream_sync_state` (`userId` TEXT NOT NULL, `activeChannelIds` TEXT NOT NULL, `lastSyncedAt` INTEGER, `rawLastSyncedAt` TEXT, `markedAllReadAt` INTEGER, PRIMARY KEY(`userId`));

CREATE TABLE IF NOT EXISTS `SystemIdInfo` (`work_spec_id` TEXT NOT NULL, `generation` INTEGER NOT NULL DEFAULT 0, `system_id` INTEGER NOT NULL, PRIMARY KEY(`work_spec_id`, `generation`), FOREIGN KEY(`work_spec_id`) REFERENCES `WorkSpec`(`id`) ON UPDATE CASCADE ON DELETE CASCADE );

CREATE TABLE IF NOT EXISTS `SystemIdInfo` (`work_spec_id` TEXT NOT NULL, `system_id`
    INTEGER NOT NULL, PRIMARY KEY(`work_spec_id`), FOREIGN KEY(`work_spec_id`)
    REFERENCES `WorkSpec`(`id`) ON UPDATE CASCADE ON DELETE CASCADE )
    ;

CREATE TABLE IF NOT EXISTS `user_activity_log` (`log_date` TEXT NOT NULL, `activity` TEXT NOT NULL, `log_time` TEXT NOT NULL, `is_synced` INTEGER, PRIMARY KEY(`log_date`));

CREATE TABLE IF NOT EXISTS `user_budgets` (`date` INTEGER NOT NULL, `amount` REAL NOT NULL, `activity_type` INTEGER NOT NULL, PRIMARY KEY(`date`, `activity_type`));

CREATE TABLE IF NOT EXISTS `UserCustomFastingLogs` (`server_id` INTEGER, `user_fasting_plan_id` INTEGER NOT NULL, `started_at` INTEGER NOT NULL, `ended_at` INTEGER NOT NULL, `is_goal_met` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, `is_synced` INTEGER NOT NULL, `id` TEXT NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `UserFastingPlans` (`id` INTEGER NOT NULL, `fasting_hours` INTEGER NOT NULL, `eating_hours` INTEGER NOT NULL, `plan_start_date` TEXT NOT NULL, `plan_end_date` TEXT, `fasting_starts_at` INTEGER NOT NULL, `fasting_ends_at` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `UserMealPreferences` (`date` INTEGER NOT NULL, `meal_type` TEXT NOT NULL, `meal_type_int` INTEGER NOT NULL, `display_name` TEXT NOT NULL, `meal_time` INTEGER NOT NULL, `calories` INTEGER NOT NULL, `calories_percent` REAL NOT NULL, `carbs_budget` REAL NOT NULL, `protein_budget` REAL NOT NULL, `fats_budget` REAL NOT NULL, `fibre_budget` REAL NOT NULL, `is_calorie_credit_back` INTEGER NOT NULL, PRIMARY KEY(`date`, `meal_type_int`, `is_calorie_credit_back`));

CREATE TABLE IF NOT EXISTS `UserMealPreferencesNew` (date INTEGER NOT NULL, meal_type TEXT NOT NULL, meal_type_int INTEGER NOT NULL, display_name TEXT NOT NULL, meal_time INTEGER NOT NULL, calories INTEGER NOT NULL,calories_percent REAL NOT NULL, carbs_budget REAL NOT NULL, protein_budget REAL NOT NULL, fats_budget REAL NOT NULL, fibre_budget REAL NOT NULL, is_calorie_credit_back INTEGER NOT NULL, PRIMARY KEY(date, meal_type_int, is_calorie_credit_back));

CREATE TABLE IF NOT EXISTS `UserRatingPublishDetail` (`data` TEXT NOT NULL, `priority` INTEGER NOT NULL, `id` INTEGER NOT NULL, `user_responded` INTEGER NOT NULL, `user_responded_timestamp` INTEGER NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `UserWorkoutSetActivity` (`activity` INTEGER NOT NULL, `deleted` INTEGER NOT NULL, `updated_at` INTEGER NOT NULL, `workout_set_id` INTEGER NOT NULL, PRIMARY KEY(`workout_set_id`, `activity`));

CREATE TABLE IF NOT EXISTS `water` (`uid` TEXT NOT NULL, `server_id` TEXT, `start_time` INTEGER NOT NULL, `end_time` INTEGER NOT NULL, `volume_in_ml` REAL NOT NULL, `source` INTEGER NOT NULL, `platform_source` INTEGER NOT NULL, `metadata_id` TEXT, `client_record_id` TEXT, `client_record_version` TEXT, `data_origin` TEXT, `last_modified_time` TEXT, `recording_method` TEXT, `is_synced` INTEGER NOT NULL, `is_deleted` INTEGER NOT NULL, PRIMARY KEY(`uid`, `platform_source`, `source`));

CREATE TABLE IF NOT EXISTS `WorkName` (`name` TEXT NOT NULL, `work_spec_id` TEXT NOT NULL, PRIMARY KEY(`name`, `work_spec_id`), FOREIGN KEY(`work_spec_id`) REFERENCES `WorkSpec`(`id`) ON UPDATE CASCADE ON DELETE CASCADE );

CREATE TABLE IF NOT EXISTS `workout_day_plan_log` (`plan_id` TEXT NOT NULL, `workout_log_entry_id` INTEGER NOT NULL, `date` TEXT NOT NULL, PRIMARY KEY(`plan_id`, `workout_log_entry_id`, `date`));

CREATE TABLE IF NOT EXISTS `workout_day_plan` (`day` INTEGER NOT NULL, `day_plan` TEXT, `rest_day` INTEGER NOT NULL, `name` TEXT, `autogenerated` INTEGER NOT NULL, `updated_at` TEXT, `plan_generated` INTEGER NOT NULL, PRIMARY KEY(`day`));

CREATE TABLE IF NOT EXISTS `WorkProgress` (`work_spec_id` TEXT NOT NULL, `progress`
    BLOB NOT NULL, PRIMARY KEY(`work_spec_id`), FOREIGN KEY(`work_spec_id`)
    REFERENCES `WorkSpec`(`id`) ON UPDATE CASCADE ON DELETE CASCADE )
    ;

CREATE TABLE IF NOT EXISTS `WorkProgress` (`work_spec_id` TEXT NOT NULL, `progress` BLOB NOT NULL, PRIMARY KEY(`work_spec_id`), FOREIGN KEY(`work_spec_id`) REFERENCES `WorkSpec`(`id`) ON UPDATE CASCADE ON DELETE CASCADE );

CREATE TABLE IF NOT EXISTS `WorkSpec` (`id` TEXT NOT NULL, `state` INTEGER NOT NULL, `worker_class_name` TEXT NOT NULL, `input_merger_class_name` TEXT NOT NULL, `input` BLOB NOT NULL, `output` BLOB NOT NULL, `initial_delay` INTEGER NOT NULL, `interval_duration` INTEGER NOT NULL, `flex_duration` INTEGER NOT NULL, `run_attempt_count` INTEGER NOT NULL, `backoff_policy` INTEGER NOT NULL, `backoff_delay_duration` INTEGER NOT NULL, `last_enqueue_time` INTEGER NOT NULL DEFAULT -1, `minimum_retention_duration` INTEGER NOT NULL, `schedule_requested_at` INTEGER NOT NULL, `run_in_foreground` INTEGER NOT NULL, `out_of_quota_policy` INTEGER NOT NULL, `period_count` INTEGER NOT NULL DEFAULT 0, `generation` INTEGER NOT NULL DEFAULT 0, `next_schedule_time_override` INTEGER NOT NULL DEFAULT 9223372036854775807, `next_schedule_time_override_generation` INTEGER NOT NULL DEFAULT 0, `stop_reason` INTEGER NOT NULL DEFAULT -256, `required_network_type` INTEGER NOT NULL, `requires_charging` INTEGER NOT NULL, `requires_device_idle` INTEGER NOT NULL, `requires_battery_not_low` INTEGER NOT NULL, `requires_storage_not_low` INTEGER NOT NULL, `trigger_content_update_delay` INTEGER NOT NULL, `trigger_max_content_delay` INTEGER NOT NULL, `content_uri_triggers` BLOB NOT NULL, PRIMARY KEY(`id`));

CREATE TABLE IF NOT EXISTS `WorkTag` (`tag` TEXT NOT NULL, `work_spec_id` TEXT NOT NULL, PRIMARY KEY(`tag`, `work_spec_id`), FOREIGN KEY(`work_spec_id`) REFERENCES `WorkSpec`(`id`) ON UPDATE CASCADE ON DELETE CASCADE );

CREATE TABLE IF NOT EXISTS `yoga_day_plan` (`day` INTEGER NOT NULL, `modified_at` INTEGER NOT NULL, `rest_day` INTEGER, `sections` TEXT, PRIMARY KEY(`day`));

CREATE TABLE IF NOT EXISTS `yoga_pan_log` (`_id` INTEGER NOT NULL, `yoga_id` INTEGER NOT NULL, `date` TEXT, PRIMARY KEY(`_id`));

CREATE TABLE IF NOT EXISTS android_metadata (locale TEXT);

CREATE TABLE IF NOT EXISTS app2 ( app_id TEXT NOT NULL, first_open_count INTEGER NOT NULL, PRIMARY KEY (app_id));;

CREATE TABLE IF NOT EXISTS app_session (session_id TEXT NOT NULL, session_start INTEGER NOT NULL, session_end INTEGER NOT NULL, session_time INTEGER NOT NULL, session_minimize INTEGER NOT NULL, is_synced INTEGER NOT NULL, pre_auth_key TEXT, user_id INTEGER NOT NULL, app_session_ended INTEGER NOT NULL, PRIMARY KEY(session_id));

CREATE TABLE IF NOT EXISTS apps ( app_id TEXT NOT NULL, app_instance_id TEXT, gmp_app_id TEXT, resettable_device_id_hash TEXT, last_bundle_index INTEGER NOT NULL, last_bundle_end_timestamp INTEGER NOT NULL, PRIMARY KEY (app_id)) ;;

CREATE TABLE IF NOT EXISTS audience_filter_values ( app_id TEXT NOT NULL, audience_id INTEGER NOT NULL, current_results BLOB, PRIMARY KEY (app_id, audience_id));;

CREATE TABLE IF NOT EXISTS conditional_properties ( app_id TEXT NOT NULL, origin TEXT NOT NULL, name TEXT NOT NULL, value BLOB NOT NULL, creation_timestamp INTEGER NOT NULL, active INTEGER NOT NULL, trigger_event_name TEXT, trigger_timeout INTEGER NOT NULL, timed_out_event BLOB,triggered_event BLOB, triggered_timestamp INTEGER NOT NULL, time_to_live INTEGER NOT NULL, expired_event BLOB, PRIMARY KEY (app_id, name)) ;;

CREATE TABLE IF NOT EXISTS consent_settings ( app_id TEXT NOT NULL, consent_state TEXT NOT NULL, PRIMARY KEY (app_id));;

CREATE TABLE IF NOT EXISTS default_event_params ( app_id TEXT NOT NULL, parameters BLOB NOT NULL, PRIMARY KEY (app_id));;

CREATE TABLE IF NOT EXISTS event_filters ( app_id TEXT NOT NULL, audience_id INTEGER NOT NULL, filter_id INTEGER NOT NULL, event_name TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY (app_id, event_name, audience_id, filter_id));;

CREATE TABLE IF NOT EXISTS events ( app_id TEXT NOT NULL, name TEXT NOT NULL, lifetime_count INTEGER NOT NULL, current_bundle_count INTEGER NOT NULL, last_fire_timestamp INTEGER NOT NULL, PRIMARY KEY (app_id, name)) ;;

CREATE TABLE IF NOT EXISTS events_snapshot ( app_id TEXT NOT NULL, name TEXT NOT NULL, lifetime_count INTEGER NOT NULL, current_bundle_count INTEGER NOT NULL, last_fire_timestamp INTEGER NOT NULL, last_bundled_timestamp INTEGER, last_bundled_day INTEGER, last_sampled_complex_event_id INTEGER, last_sampling_rate INTEGER, last_exempt_from_sampling INTEGER, current_session_count INTEGER, PRIMARY KEY (app_id, name)) ;;

CREATE TABLE IF NOT EXISTS ExoPlayerVersions (feature INTEGER NOT NULL,instance_uid TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY (feature, instance_uid));

CREATE TABLE IF NOT EXISTS group_info (_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,ch_id INTEGER NOT NULL,desc TEXT NOT NULL,has_exited INTEGER NOT NULL DEFAULT 0,group_id INTEGER NOT NULL,image_url TEXT,ibg INTEGER NOT NULL DEFAULT 0,team_group INTEGER NOT NULL DEFAULT 0,name TEXT NOT NULL,display_name TEXT NOT NULL,topic TEXT,is_deleted INTEGER NOT NULL DEFAULT 0,extras TEXT,is_assistant_group INTEGER DEFAULT 0, UNIQUE(group_id,ch_id) ON CONFLICT REPLACE);

CREATE TABLE IF NOT EXISTS group_members (_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,group_id INTEGER NOT NULL,has_exited INTEGER NOT NULL DEFAULT 0,is_deleted INTEGER NOT NULL DEFAULT 0,extras TEXT, UNIQUE(user_id, group_id) ON CONFLICT REPLACE);

CREATE TABLE IF NOT EXISTS group_members_info (_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,profile_pic TEXT,user_name TEXT,user_id INTEGER NOT NULL UNIQUE ON CONFLICT REPLACE,is_deleted INTEGER NOT NULL DEFAULT 0,user_type TEXT NOT NULL,extras TEXT);

CREATE TABLE IF NOT EXISTS main_event_params ( app_id TEXT NOT NULL, event_id TEXT NOT NULL, children_to_process INTEGER NOT NULL, main_event BLOB NOT NULL, PRIMARY KEY (app_id));;

CREATE TABLE IF NOT EXISTS no_data_mode_events ( app_id TEXT NOT NULL, name TEXT NOT NULL, data BLOB NOT NULL, timestamp_millis INTEGER NOT NULL);;

CREATE TABLE IF NOT EXISTS property_filters ( app_id TEXT NOT NULL, audience_id INTEGER NOT NULL, filter_id INTEGER NOT NULL, property_name TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY (app_id, property_name, audience_id, filter_id));;

CREATE TABLE IF NOT EXISTS queue ( app_id TEXT NOT NULL, bundle_end_timestamp INTEGER NOT NULL, data BLOB NOT NULL);;

CREATE TABLE IF NOT EXISTS raw_events ( app_id TEXT NOT NULL, name TEXT NOT NULL, timestamp INTEGER NOT NULL, metadata_fingerprint INTEGER NOT NULL, data BLOB NOT NULL);;

CREATE TABLE IF NOT EXISTS raw_events_metadata ( app_id TEXT NOT NULL, metadata_fingerprint INTEGER NOT NULL, metadata BLOB NOT NULL, PRIMARY KEY (app_id, metadata_fingerprint));;

CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY,identity_hash TEXT);

CREATE TABLE IF NOT EXISTS trigger_uris ( app_id TEXT NOT NULL, trigger_uri TEXT NOT NULL, timestamp_millis INTEGER NOT NULL, source INTEGER NOT NULL);;

CREATE TABLE IF NOT EXISTS upload_queue ( app_id TEXT NOT NULL, upload_uri TEXT NOT NULL, upload_headers TEXT NOT NULL, upload_type INTEGER NOT NULL, measurement_batch BLOB NOT NULL, retry_count INTEGER NOT NULL, creation_timestamp INTEGER NOT NULL );;

CREATE TABLE IF NOT EXISTS user_attributes ( app_id TEXT NOT NULL, name TEXT NOT NULL, set_timestamp INTEGER NOT NULL, value BLOB NOT NULL, PRIMARY KEY (app_id, name)) ;;

CREATE TABLE issue_conversation(_id INTEGER NOT NULL PRIMARY KEY, issue_id INTEGER DEFAULT 0, created_at TEXT, sent_time TEXT, body TEXT, freshdesk_user_id TEXT, is_from_agent INTEGER DEFAULT 0, is_synced INTEGER DEFAULT 0, attachment TEXT DEFAULT NULL);;

CREATE TABLE leaderboard(_id INTEGER NOT NULL primary key,display_name VARCHAR(20) , username TEXT NOT NULL UNIQUE, rank INTEGER DEFAULT 0, points INTEGER DEFAULT 0,avatar_image TEXT NOT NULL DEFAULT 'https://healthifyme.com/static/img/members/mukund.50f452af989c.jpg' );;

CREATE TABLE log_event_dropped (log_source VARCHAR(45) NOT NULL,reason INTEGER NOT NULL,events_dropped_count BIGINT NOT NULL,PRIMARY KEY(log_source, reason));

CREATE TABLE messages(_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,key TEXT UNIQUE,ch_id TEXT NOT NULL,grp_id TEXT NOT NULL,text TEXT,timeStamp INTEGER NOT NULL,type INTEGER NOT NULL DEFAULT 0,uid TEXT NOT NULL,platform INTEGER DEFAULT 1,status INTEGER NOT NULL DEFAULT 0,attach_url TEXT,perc_uploaded INTEGER DEFAULT 0,confidence INTEGER DEFAULT 0,loc_fp TEXT,is_read INTEGER DEFAULT 0,f_upl_status INTEGER DEFAULT 0,img_info BLOB,video_info BLOB,reply_message_key TEXT,is_deleted INTEGER DEFAULT 0, sender_name TEXT,extras TEXT,rating INTEGER DEFAULT 3);;

CREATE TABLE objectives_table(body_text TEXT,color TEXT,completed_at DATETIME,created_at DATETIME,date DATE,extra_params TEXT,header_text TEXT,image_url TEXT,is_primary INTEGER DEFAULT 1,is_synced INTEGER DEFAULT 1,last_updated_at DATETIME,objective_id INTEGER,points INTEGER,primary_action TEXT,rule_id INTEGER,_id INTEGER PRIMARY KEY ON CONFLICT REPLACE,bonus_text TEXT,obj_order INTEGER,type_id INTEGER,precondition_id INTEGER,is_deleted INTEGER DEFAULT 0,expires_at INTEGER);

CREATE TABLE points_log(_id INTEGER NOT NULL primary key AUTOINCREMENT,event_tag TEXT NOT NULL UNIQUE ON CONFLICT REPLACE, points_scored INTEGER NOT NULL,points_feed_text TEXT NOT NULL, event_id INTEGER NOT NULL, is_synced INTEGER NOT NULL DEFAULT 1, entry_date INTEGER NOT NULL DEFAULT (strftime('%s','now')), date_string TEXT NOT NULL);

CREATE TABLE serverCache (path TEXT PRIMARY KEY, value BLOB);;

CREATE TABLE temp_;

CREATE TABLE trackedKeys (id INTEGER, key TEXT);;

CREATE TABLE trackedQueries (id INTEGER PRIMARY KEY, path TEXT, queryParams TEXT, lastUse INTEGER, complete INTEGER, active INTEGER);;

CREATE TABLE transport_contexts (_id INTEGER PRIMARY KEY, backend_name TEXT NOT NULL, priority INTEGER NOT NULL, next_request_ms INTEGER NOT NULL);

CREATE TABLE user_issues(id INTEGER NOT NULL PRIMARY KEY, issue_id INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL, subject TEXT NOT NULL, new_msg_count INTEGER DEFAULT 0, status TEXT, created_at TEXT, attachment TEXT DEFAULT NULL, rated INTEGER DEFAULT 0);;

CREATE TABLE water_log(_id INTEGER NOT NULL primary key AUTOINCREMENT, amount integer NOT NULL default 0, server_id integer NOT NULL default -1, is_synced integer NOT NULL default 0, goal integer NOT NULL default 0, date Date NOT NULL DEFAULT NOW , UNIQUE (server_id, date)) ;

CREATE TABLE weightgoallog(_id INTEGER NOT NULL primary key autoincrement, id INTEGER NOT NULL, start_date date, end_date date, start_weight DOUBLE DEFAULT 0, target_weight DOUBLE DEFAULT 0, is_active INTEGER DEFAULT 0, deactivate_time date DEFAULT null, popup_shown INTEGER DEFAULT 0, dirtybit INTEGER NOT NULL DEFAULT 1 );

CREATE TABLE weightlog(_id INTEGER NOT NULL primary key autoincrement,date date NOT NULL DEFAULT CURRENT_DATE UNIQUE ON CONFLICT REPLACE,image_url TEXT default null,weight DOUBLE DEFAULT 0, source INTEGER DEFAULT 1, added_by_name TEXT DEFAULT NULL, id INTEGER NOT NULL DEFAULT -1, dirtybit INTEGER NOT NULL DEFAULT 1 );

CREATE TABLE workoutlog(_id INTEGER NOT NULL primary key ,install_id TEXT,server_id integer NOT NULL default -1,name TEXT NOT NULL,category TEXT NOT NULL,workouttype integer NOT NULL,energy double DEFAULT 0.0,level TEXT DEFAULT NULL,incline integer DEFAULT 0,distance double DEFAULT 0.0,reps integer DEFAULT 0,time double DEFAULT 0.0,met double DEFAULT NULL,isdeleted integer NOT NULL DEFAULT 0,synched integer NOT NULL DEFAULT 0,datetime Date NOT NULL DEFAULT NOW,device TEXT,steps integer DEFAULT 0 ,logtime INTEGER NOT NULL DEFAULT (strftime('%s','now')), timestamp INTEGER NOT NULL DEFAULT ;

CREATE TABLE writes (id INTEGER, path TEXT, type TEXT, part INTEGER, node BLOB, UNIQUE (id, part));;
