CREATE TABLE `shop` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` text,
	`address` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shop_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_owner_unique` UNIQUE(`owner_id`),
	CONSTRAINT `shop_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `shop` ADD CONSTRAINT `shop_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;