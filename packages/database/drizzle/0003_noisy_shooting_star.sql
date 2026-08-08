CREATE TABLE `product` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` text,
	`price_minor` int NOT NULL,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_shop_slug_unique` UNIQUE(`shop_id`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_shop_id_shop_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shop`(`id`) ON DELETE cascade ON UPDATE no action;