const swcDefaultConfig =
  require("@nestjs/cli/lib/compiler/defaults/swc-defaults").swcDefaultsFactory()
    .swcOptions;
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = function (options) {
  return {
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: "swc-loader",
            options: swcDefaultConfig,
          },
        },
      ],
    },
    resolve: {
      alias: {
        "@libs/common": path.resolve(__dirname, "libs/common"),
        "@libs/data-access": path.resolve(__dirname, "libs/data-access"),
        "@libs/s3": path.resolve(__dirname, "libs/s3"),
        "@libs/guards": path.resolve(__dirname, "libs/guards"),
        "@libs/localization": path.resolve(__dirname, "libs/localization"),
        "@libs/services/auth": path.resolve(
          __dirname,
          "libs/services/auth/src",
        ),
        "@libs/services/mail": path.resolve(__dirname, "libs/services/mail"),
        "@libs/services/rides": path.resolve(
          __dirname,
          "libs/services/rides/src",
        ),
        "@libs/services/ably": path.resolve(
          __dirname,
          "libs/services/ably/src",
        ),
        "@libs/services/favourites": path.resolve(
          __dirname,
          "libs/services/favourites/src",
        ),
        "@libs/services/firebase-messaging": path.resolve(
          __dirname,
          "libs/services/firebase-messaging/src",
        ),
        "@libs/services/notification": path.resolve(
          __dirname,
          "libs/services/notification/src",
        ),
        "@libs/services/user": path.resolve(
          __dirname,
          "libs/services/user/src",
        ),
        "@libs/services/profile": path.resolve(
          __dirname,
          "libs/services/profile/src",
        ),
        "@libs/services": path.resolve(__dirname, "libs/services"),
        "@libs": path.resolve(__dirname, "libs"),
      },
      extensions: [".ts", ".js"],
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(
              __dirname,
              "libs/services/email-template/src/templates",
            ),
            to: path.resolve(
              __dirname,
              "dist/libs/services/email-template/src/templates",
            ),
          },
          {
            from: path.resolve(__dirname, "libs/services/mail/templates"),
            to: path.resolve(__dirname, "dist/libs/services/mail/templates"),
          },
          // Copy email template assets from mail service
          {
            from: path.resolve(__dirname, "libs/services/mail/templates"),
            to: path.resolve(__dirname, "dist/libs/services/mail/templates"),
          },
          // Copy base email template to each app's output directory
          // so EmailTemplateParserService can find it at runtime
          {
            from: path.resolve(
              __dirname,
              "libs/services/email-template/src/templates",
            ),
            to: path.resolve(__dirname, "dist/apps/api/templates"),
          },
          {
            from: path.resolve(
              __dirname,
              "libs/services/email-template/src/templates",
            ),
            to: path.resolve(__dirname, "dist/apps/admin-api/templates"),
          },
          {
            from: path.resolve(
              __dirname,
              "libs/services/email-template/src/templates",
            ),
            to: path.resolve(__dirname, "dist/apps/driver-api/templates"),
          },
        ],
      }),
    ],
  };
};
