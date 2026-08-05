ALTER TABLE `verification` MODIFY COLUMN `value` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `verification` ADD CONSTRAINT `verification_value_unique` UNIQUE(`value`);