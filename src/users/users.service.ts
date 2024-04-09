import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import mongoose, { Model } from 'mongoose';
import { genSaltSync, hashSync, compareSync } from 'bcryptjs';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from './user.interface';
import aqp from 'api-query-params';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
  ) {}

  getHashPassword = (password: string) => {
    var salt = genSaltSync(10);
    var hash = hashSync(password, salt);

    return hash;
  };

  async create(createUserDto: CreateUserDto, user: IUser) {
    let { name, email, password, age, gender, address, role, company } =
      createUserDto;

    // Checking mail is exists?
    let isCheckeExistsed = await this.userModel.findOne({
      email,
    });

    if (isCheckeExistsed) {
      throw new BadRequestException(
        `Email '${email}' is existsed in database, please choose the another one!`,
      );
    }

    const passwordHashed = this.getHashPassword(password);
    let newUser = await this.userModel.create({
      name,
      email,
      password: passwordHashed,
      age,
      gender,
      address,
      role,
      company,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });

    return {
      _id: newUser._id,
      createdAt: newUser.createdAt,
    };
  }

  async register(user: RegisterUserDto) {
    let { name, email, password, age, gender, address } = user;

    // Checking mail is exists?
    let isCheckeExistsed = await this.userModel.findOne({
      email,
    });

    if (isCheckeExistsed) {
      throw new BadRequestException(
        `Email '${email}' is existsed in database, please choose the another one!`,
      );
    }

    const passwordHashed = this.getHashPassword(password);
    let userRegister = await this.userModel.create({
      name,
      email,
      password: passwordHashed,
      age,
      gender,
      address,
      role: 'USER',
    });

    return userRegister;
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    let offset = (currentPage - 1) * limit;
    let defaultLimit = limit ? limit : 10;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.userModel
      .find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .populate(population)
      .exec();

    return {
      meta: {
        current: currentPage, //trang hiện tại
        pageSize: limit, //số lượng bản ghi đã lấy
        pages: totalPages, //tổng số trang với điều kiện query
        total: totalItems, // tổng số phần tử (số bản ghi)
      },
      result, //kết quả query
    };
  }

  findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'User not found';
    return this.userModel
      .findById(id)
      .select('-password') // Another way exclude password from results
      .then((user) => user)
      .catch((err) => err.message);
  }

  async findOneByUsername(username: string) {
    return await this.userModel
      .findOne({
        email: username,
      })
      .then((user) => user)
      .catch((err) => err.message);
  }

  async update(updateUserDto: UpdateUserDto, user: IUser) {
    return await this.userModel.updateOne(
      {
        _id: updateUserDto._id,
      },
      {
        ...updateUserDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'User not found';

    let isUpdated = await this.userModel.updateOne(
      {
        _id: id,
      },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );

    if (isUpdated) {
      return this.userModel.softDelete({
        _id: id,
      });
    }
  }

  isValidPassword(password: string, hash: string) {
    console.log(password, hash);

    return compareSync(password, hash);
  }

  updateUserToken = async (_id: string, refreshToken: string) => {
    await this.userModel.updateOne({ _id }, { refreshToken });
  };

  findUserByToken = async (refreshToken: string) => {
    return await this.userModel.findOne({ refreshToken });
  };
}
