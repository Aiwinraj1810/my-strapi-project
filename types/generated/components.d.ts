import type { Schema, Struct } from '@strapi/strapi';

export interface DescriptionTextSection extends Struct.ComponentSchema {
  collectionName: 'components_description_text_sections';
  info: {
    displayName: 'Text-Section';
    icon: 'pencil';
  };
  attributes: {
    content: Schema.Attribute.RichText;
    Title: Schema.Attribute.String;
  };
}

export interface HeroHero extends Struct.ComponentSchema {
  collectionName: 'components_hero_heroes';
  info: {
    displayName: 'Hero';
    icon: 'alien';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    heading: Schema.Attribute.String;
    subheading: Schema.Attribute.RichText;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'description.text-section': DescriptionTextSection;
      'hero.hero': HeroHero;
    }
  }
}
