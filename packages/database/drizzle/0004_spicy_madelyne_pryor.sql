CREATE TABLE `category` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `category_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_shop_slug_unique` UNIQUE(`shop_id`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `product` ADD `category_id` varchar(36);--> statement-breakpoint
ALTER TABLE `category` ADD CONSTRAINT `category_shop_id_shop_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shop`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_category_id_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `product_category_id_idx` ON `product` (`category_id`);